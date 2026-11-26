"""One-time backfill: every Raptors season since 1995-96 into Supabase.

Runs from a home connection (stats.nba.com blocks cloud servers).
Writes through the temporary ingest_rows RPC, which is dropped afterwards.
"""
import json
import os
import sys
import time

import requests
from nba_api.stats.endpoints import (
    drafthistory,
    franchiseplayers,
    leaguedashlineups,
    leaguegamefinder,
    playbyplayv3,
    playergamelogs,
    teamgamelogs,
    teamyearbyyearstats,
)

TOR = 1610612761
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://mhphrklhfkvlecaeyaox.supabase.co")
ANON = os.environ["SUPABASE_ANON_KEY"]
TOKEN = os.environ["INGEST_TOKEN"]
RPC = SUPABASE_URL + "/rest/v1/rpc/ingest_rows"
HEADERS = {"apikey": ANON, "Authorization": "Bearer " + ANON, "Content-Type": "application/json"}

SEASONS = [f"{y}-{str(y + 1)[-2:]}" for y in range(1995, 2027)]
LINEUP_SEASONS = [s for s in SEASONS if int(s[:4]) >= 2007]
PBP_SEASONS = ["2025-26", "2026-27"]
SEASON_TYPES = {"2": "Regular Season", "4": "Playoffs", "5": "Play-In"}
LOG_TYPES = ["Regular Season", "Playoffs", "PlayIn"]


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def fetch(endpoint, idx=0, tries=4, **kw):
    for i in range(tries):
        try:
            time.sleep(0.8)
            df = endpoint(timeout=60, **kw).get_data_frames()[idx]
            return json.loads(df.to_json(orient="records"))
        except Exception as e:  # noqa: BLE001
            log("retry", endpoint.__name__, kw.get("season") or kw.get("season_nullable") or kw.get("game_id"), i + 1, repr(e)[:160])
            time.sleep(6 * (i + 1))
    log("GAVE UP", endpoint.__name__, kw)
    return []


def ingest(table, rows, batch=400):
    total = 0
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        for attempt in range(4):
            r = requests.post(RPC, headers=HEADERS, json={"p_token": TOKEN, "p_table": table, "p_rows": chunk}, timeout=120)
            if r.ok:
                total += int(r.json() or 0)
                break
            log("ingest error", table, r.status_code, r.text[:300])
            time.sleep(5 * (attempt + 1))
        else:
            raise RuntimeError(f"ingest failed for {table}")
    log(f"{table}: +{total} rows (sent {len(rows)})")
    return total


def slim(d):
    drop_suffix = ("_RANK",)
    drop = {"SEASON_YEAR", "TEAM_ID", "TEAM_ABBREVIATION", "TEAM_NAME", "PLAYER_NAME", "NICKNAME", "GAME_DATE", "MATCHUP", "WL", "AVAILABLE_FLAG", "WNBA_FANTASY_PTS"}
    return {k: v for k, v in d.items() if not k.endswith(drop_suffix) and k not in drop}


def main():
    # 1. Seasons
    rows = fetch(teamyearbyyearstats.TeamYearByYearStats, team_id=TOR)
    seasons = []
    for r in rows:
        pw, pl = r.get("PO_WINS") or 0, r.get("PO_LOSSES") or 0
        seasons.append({
            "season_id": r["YEAR"], "start_year": int(r["YEAR"][:4]),
            "wins": r.get("WINS"), "losses": r.get("LOSSES"),
            "playoff_result": f"{pw}-{pl}" if (pw + pl) > 0 else None,
            "raw": slim(r),
        })
    ingest("seasons", seasons)
    known_seasons = {s["season_id"] for s in seasons}

    # 2. Games
    rows = fetch(leaguegamefinder.LeagueGameFinder, team_id_nullable=TOR, league_id_nullable="00")
    games = {}
    for r in rows:
        sid = str(r["SEASON_ID"])
        stype = SEASON_TYPES.get(sid[0])
        y = int(sid[1:])
        season = f"{y}-{str(y + 1)[-2:]}"
        if not stype or season not in known_seasons:
            continue
        m = r["MATCHUP"]
        pts, pm = r.get("PTS"), r.get("PLUS_MINUS")
        games[r["GAME_ID"]] = {
            "game_id": r["GAME_ID"], "season_id": season, "season_type": stype,
            "game_date": r["GAME_DATE"][:10], "is_home": " vs. " in m,
            "opponent_abbr": m.split()[-1], "team_pts": pts,
            "opp_pts": int(round(pts - pm)) if pts is not None and pm is not None else None,
            "wl": r.get("WL"),
        }
    ingest("games", list(games.values()))

    # 3. Player and team game logs
    players = {}
    pgb = []
    tgb = []
    for s in SEASONS:
        for st in LOG_TYPES:
            base = fetch(playergamelogs.PlayerGameLogs, season_nullable=s, season_type_nullable=st, team_id_nullable=TOR)
            if not base:
                continue
            adv = fetch(playergamelogs.PlayerGameLogs, season_nullable=s, season_type_nullable=st, team_id_nullable=TOR, measure_type_player_game_logs_nullable="Advanced")
            adv_by = {(a["GAME_ID"], a["PLAYER_ID"]): slim(a) for a in adv}
            for r in base:
                if r["GAME_ID"] not in games:
                    continue
                players[r["PLAYER_ID"]] = r["PLAYER_NAME"]
                pgb.append({
                    "game_id": r["GAME_ID"], "player_id": r["PLAYER_ID"], "team_side": "TOR",
                    "minutes": r.get("MIN"), "pts": r.get("PTS"), "reb": r.get("REB"), "ast": r.get("AST"),
                    "stl": r.get("STL"), "blk": r.get("BLK"), "tov": r.get("TOV"), "pf": r.get("PF"),
                    "fgm": r.get("FGM"), "fga": r.get("FGA"), "fg3m": r.get("FG3M"), "fg3a": r.get("FG3A"),
                    "ftm": r.get("FTM"), "fta": r.get("FTA"), "oreb": r.get("OREB"), "dreb": r.get("DREB"),
                    "plus_minus": int(r["PLUS_MINUS"]) if r.get("PLUS_MINUS") is not None else None,
                    "traditional": slim(r), "advanced": adv_by.get((r["GAME_ID"], r["PLAYER_ID"])),
                })
            tbase = fetch(teamgamelogs.TeamGameLogs, season_nullable=s, season_type_nullable=st, team_id_nullable=TOR)
            tadv = {a["GAME_ID"]: slim(a) for a in fetch(teamgamelogs.TeamGameLogs, season_nullable=s, season_type_nullable=st, team_id_nullable=TOR, measure_type_player_game_logs_nullable="Advanced")}
            tff = {a["GAME_ID"]: slim(a) for a in fetch(teamgamelogs.TeamGameLogs, season_nullable=s, season_type_nullable=st, team_id_nullable=TOR, measure_type_player_game_logs_nullable="Four Factors")}
            for r in tbase:
                if r["GAME_ID"] in games:
                    tgb.append({"game_id": r["GAME_ID"], "team_side": "TOR", "traditional": slim(r),
                                "advanced": tadv.get(r["GAME_ID"]), "four_factors": tff.get(r["GAME_ID"])})
            log("season", s, st, "player rows so far", len(pgb))

    # 4. Franchise players (all-time totals) -> players + leaders
    fp = fetch(franchiseplayers.FranchisePlayers, team_id=TOR)
    for r in fp:
        if r.get("PERSON_ID"):
            players.setdefault(r["PERSON_ID"], r.get("PLAYER"))
    ingest("players", [{"player_id": pid, "full_name": name or str(pid)} for pid, name in players.items()])
    ingest("player_game_box", pgb, batch=300)
    ingest("team_game_box", tgb, batch=300)

    leaders = []
    for cat in ["PTS", "REB", "AST", "STL", "BLK", "FG3M", "GP"]:
        ranked = sorted([r for r in fp if r.get(cat) is not None], key=lambda r: r[cat], reverse=True)[:10]
        for i, r in enumerate(ranked, 1):
            leaders.append({"category": cat, "rank": i, "player_id": r["PERSON_ID"], "value": r[cat]})
    ingest("franchise_leaders", leaders)

    # 5. Draft history
    dh = fetch(drafthistory.DraftHistory, team_id_nullable=TOR)
    ingest("draft_history", [{
        "draft_year": int(r["SEASON"]), "round": r.get("ROUND_NUMBER") or 0, "pick": r.get("OVERALL_PICK") or 0,
        "player_name": r.get("PLAYER_NAME") or "", "player_id": r.get("PERSON_ID"), "raw": slim(r),
    } for r in dh])

    # 6. Lineups (2007-08 onward, regular season)
    lu = []
    for s in LINEUP_SEASONS:
        for gq in (5, 3, 2):
            rows = fetch(leaguedashlineups.LeagueDashLineups, team_id_nullable=TOR, group_quantity=gq, season=s,
                         season_type_all_star="Regular Season", measure_type_detailed_defense="Advanced",
                         per_mode_detailed="Totals")
            for r in rows:
                ids = [int(x) for x in str(r["GROUP_ID"]).strip("-").split("-") if x]
                lu.append({"season_id": s, "group_size": gq, "group_id": r["GROUP_ID"], "player_ids": ids,
                           "minutes": r.get("MIN"), "possessions": r.get("POSS"),
                           "off_rtg": r.get("OFF_RATING"), "def_rtg": r.get("DEF_RATING"), "net_rtg": r.get("NET_RATING"),
                           "raw": slim(r), "garbage_filtered": False})
        log("lineups", s, len(lu))
    ingest("lineups", lu, batch=300)

    # 7. Play-by-play for the last two seasons (garbage-time filter needs it)
    for gid, g in sorted(games.items()):
        if g["season_id"] not in PBP_SEASONS:
            continue
        acts = fetch(playbyplayv3.PlayByPlayV3, game_id=gid)
        rows = []
        for a in acts:
            h, aw = a.get("scoreHome"), a.get("scoreAway")
            margin = None
            if h not in (None, "") and aw not in (None, ""):
                margin = (int(h) - int(aw)) * (1 if g["is_home"] else -1)
            rows.append({"game_id": gid, "action_number": a.get("actionNumber"), "period": a.get("period"),
                         "clock": a.get("clock"), "score_margin": margin, "action_type": a.get("actionType"),
                         "player_id": a.get("personId") or None, "description": a.get("description"),
                         "raw": {"team": a.get("teamTricode"), "sub": a.get("subType"), "h": h, "a": aw}})
        if rows:
            ingest("play_by_play", rows, batch=500)

    log("DONE")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        log("FAILED", repr(e))
        sys.exit(1)
