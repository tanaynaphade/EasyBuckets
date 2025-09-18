#!/usr/bin/env python3
"""
NBA Playoff Data Updater
Fetches Play-In, Playoff, and Finals data to add to your existing CSV
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
import re
import warnings
warnings.filterwarnings('ignore')

# Try importing required modules
try:
    from nba_api.stats.endpoints import leaguegamelog
    NBA_API_AVAILABLE = True
    print("✅ NBA API available")
except ImportError:
    NBA_API_AVAILABLE = False
    print("❌ NBA API not available. Install with: pip install nba-api")

def extract_opponent_from_matchup(matchup, team_abbrev):
    """Extract opponent from MATCHUP string"""
    if pd.isna(matchup) or not matchup:
        return 'UNK'

    try:
        matchup = matchup.strip()

        if ' @ ' in matchup:
            teams = matchup.split(' @ ')
            away_team = teams[0].strip()
            home_team = teams[1].strip()

            if away_team == team_abbrev:
                return home_team
            elif home_team == team_abbrev:
                return away_team

        elif ' vs. ' in matchup:
            teams = matchup.split(' vs. ')
            home_team = teams[0].strip()
            away_team = teams[1].strip()

            if home_team == team_abbrev:
                return away_team
            elif away_team == team_abbrev:
                return home_team

        # Fallback
        team_codes = re.findall(r'\b[A-Z]{3}\b', matchup)
        for code in team_codes:
            if code != team_abbrev:
                return code

        return 'UNK'

    except Exception as e:
        print(f"Error parsing matchup '{matchup}': {e}")
        return 'UNK'

def calculate_game_score(row):
    """Calculate Game Score"""
    try:
        return (
            row['PTS'] + 
            0.4 * row['FG'] - 
            0.7 * row['FGA'] - 
            0.4 * (row['FTA'] - row['FT']) + 
            0.7 * row['ORB'] + 
            0.3 * row['DRB'] + 
            row['STL'] + 
            0.7 * row['AST'] + 
            0.7 * row['BLK'] - 
            0.4 * row['PF'] - 
            row['TOV']
        )
    except:
        return 0.0

def convert_minutes(minutes_str):
    """Convert minutes from MM:SS to decimal"""
    if pd.isna(minutes_str) or minutes_str == '':
        return 0.0

    try:
        if isinstance(minutes_str, (int, float)):
            return float(minutes_str)

        minutes_str = str(minutes_str)
        if ':' in minutes_str:
            parts = minutes_str.split(':')
            minutes = int(parts[0])
            seconds = int(parts[1])
            return round(minutes + seconds/60, 2)
        else:
            return round(float(minutes_str), 2)
    except:
        return 0.0

def get_current_season():
    """Get current NBA season"""
    today = datetime.now()
    if today.month >= 10:
        season_start_year = today.year
    else:
        season_start_year = today.year - 1
    return f"{season_start_year}-{str(season_start_year + 1)[2:]}"

def get_nba_playoff_data(season_type='Playoffs', start_date=None):
    """
    Get NBA playoff data
    season_type options:
    - 'Play In' : Play-in tournament games
    - 'Playoffs' : Playoff games (including Finals)
    """
    if not NBA_API_AVAILABLE:
        print("❌ NBA API not available")
        return pd.DataFrame()

    print(f"🏆 Fetching {season_type} data...")

    try:
        current_season = get_current_season()
        print(f"📅 Season: {current_season}")

        # Get player game logs for playoffs
        print(f"⏳ Requesting {season_type} data from NBA.com...")
        gamelog = leaguegamelog.LeagueGameLog(
            season=current_season,
            season_type_all_star=season_type,
            player_or_team_abbreviation='P'
        )

        time.sleep(2)  # Rate limiting
        df = gamelog.get_data_frames()[0]

        print(f"📊 Retrieved {len(df)} {season_type.lower()} game records")

        if df.empty:
            print(f"❌ No {season_type.lower()} data found")
            return pd.DataFrame()

        # Filter by date if specified
        if start_date:
            df['GAME_DATE'] = pd.to_datetime(df['GAME_DATE'])
            start_dt = pd.to_datetime(start_date)
            df = df[df['GAME_DATE'] >= start_dt]
            print(f"🗓️ Filtered to {len(df)} records from {start_date} onwards")
        else:
            df['GAME_DATE'] = pd.to_datetime(df['GAME_DATE'])

        # Extract opponents
        if 'MATCHUP' in df.columns:
            print("✅ Extracting opponents...")
            df = df.copy()
            df['Opp'] = df.apply(
                lambda row: extract_opponent_from_matchup(row['MATCHUP'], row['TEAM_ABBREVIATION']), 
                axis=1
            )
        else:
            df['Opp'] = 'UNK'

        # Map columns to your CSV format
        result_df = pd.DataFrame()

        column_mapping = {
            'PLAYER_NAME': 'Player',
            'TEAM_ABBREVIATION': 'Tm',
            'Opp': 'Opp',
            'WL': 'Res',
            'MIN': 'MP',
            'FGM': 'FG',
            'FGA': 'FGA',
            'FG_PCT': 'FG%',
            'FG3M': '3P',
            'FG3A': '3PA',
            'FG3_PCT': '3P%',
            'FTM': 'FT',
            'FTA': 'FTA',
            'FT_PCT': 'FT%',
            'OREB': 'ORB',
            'DREB': 'DRB',
            'REB': 'TRB',
            'AST': 'AST',
            'STL': 'STL',
            'BLK': 'BLK',
            'TOV': 'TOV',
            'PF': 'PF',
            'PTS': 'PTS',
            'GAME_DATE': 'Data'
        }

        # Map available columns
        for old_col, new_col in column_mapping.items():
            if old_col in df.columns:
                result_df[new_col] = df[old_col]

        # Convert and clean data
        result_df['Data'] = result_df['Data'].dt.strftime('%Y-%m-%d')

        if 'MP' in result_df.columns:
            result_df['MP'] = result_df['MP'].apply(convert_minutes)

        # Convert data types
        numeric_cols = ['FG', 'FGA', '3P', '3PA', 'FT', 'FTA', 'ORB', 'DRB', 'TRB', 'AST', 'STL', 'BLK', 'TOV', 'PF', 'PTS']
        for col in numeric_cols:
            if col in result_df.columns:
                result_df[col] = pd.to_numeric(result_df[col], errors='coerce').fillna(0).astype(int)

        pct_cols = ['FG%', '3P%', 'FT%']  
        for col in pct_cols:
            if col in result_df.columns:
                result_df[col] = pd.to_numeric(result_df[col], errors='coerce').fillna(0).astype(float)

        # Calculate Game Score
        result_df['GmSc'] = result_df.apply(calculate_game_score, axis=1).round(1)

        print(f"✅ Processed {len(result_df)} {season_type.lower()} records")

        # Summary
        if not result_df.empty:
            print(f"🎯 Date range: {result_df['Data'].min()} to {result_df['Data'].max()}")
            print(f"📊 Players: {result_df['Player'].nunique()}, Teams: {result_df['Tm'].nunique()}")

        return result_df

    except Exception as e:
        print(f"❌ Error: {e}")
        return pd.DataFrame()

def update_csv_with_playoff_data(csv_path='nba_game_player_data.csv', output_path=None, season_types=None):
    """Add playoff data to existing CSV"""
    if season_types is None:
        season_types = ['Play In', 'Playoffs']

    print("🏆 NBA Playoff Data Updater")
    print("=" * 40)

    # Load existing data
    try:
        existing_df = pd.read_csv(csv_path)
        print(f"📁 Loaded existing data: {len(existing_df)} records")

        existing_df['Data'] = pd.to_datetime(existing_df['Data'])
        print(f"📅 Current data: {existing_df['Data'].min().strftime('%Y-%m-%d')} to {existing_df['Data'].max().strftime('%Y-%m-%d')}")

    except FileNotFoundError:
        print(f"❌ File {csv_path} not found!")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    # Collect all playoff data
    all_playoff_data = []

    for season_type in season_types:
        print(f"\n🔍 Fetching {season_type} data...")
        playoff_data = get_nba_playoff_data(season_type)

        if not playoff_data.empty:
            all_playoff_data.append(playoff_data)
            print(f"✅ Got {len(playoff_data)} {season_type.lower()} records")
        else:
            print(f"⚠️ No {season_type.lower()} data found")

    if not all_playoff_data:
        print("❌ No playoff data found")
        return False

    # Combine all playoff data
    combined_playoff_df = pd.concat(all_playoff_data, ignore_index=True)
    print(f"\n📊 Total new playoff records: {len(combined_playoff_df)}")

    # Ensure column consistency
    expected_columns = list(existing_df.columns)

    for col in expected_columns:
        if col not in combined_playoff_df.columns:
            if col in ['FG%', '3P%', 'FT%', 'GmSc', 'MP']:
                combined_playoff_df[col] = 0.0
            elif col in ['Opp', 'Player', 'Tm', 'Res', 'Data']:
                combined_playoff_df[col] = 'Unknown'
            else:
                combined_playoff_df[col] = 0

    # Reorder columns and combine
    combined_playoff_df = combined_playoff_df[expected_columns]
    existing_df['Data'] = existing_df['Data'].dt.strftime('%Y-%m-%d')

    final_df = pd.concat([existing_df, combined_playoff_df], ignore_index=True)
    final_df = final_df.drop_duplicates(subset=['Player', 'Data', 'Tm'], keep='last')

    print(f"📈 Final dataset: {len(final_df)} total records")
    print(f"➕ Added {len(final_df) - len(existing_df)} new playoff records")

    # Save
    if output_path is None:
        output_path = csv_path

    try:
        final_df.to_csv(output_path, index=False)
        print(f"✅ Updated data saved to: {output_path}")

        if len(combined_playoff_df) > 0:
            print(f"\n🏆 Playoff Data Summary:")
            print(f"   Date range: {combined_playoff_df['Data'].min()} to {combined_playoff_df['Data'].max()}")
            print(f"   Players: {combined_playoff_df['Player'].nunique()}")
            print(f"   Teams: {combined_playoff_df['Tm'].nunique()}")

        return True

    except Exception as e:
        print(f"❌ Error saving: {e}")
        return False

if __name__ == "__main__":
    print("🏆 NBA Playoff Data Updater")
    print("Adds Play-In, Playoff, and Finals data to your CSV")
    print()

    if not NBA_API_AVAILABLE:
        print("❌ Please install: pip install nba-api")
        exit(1)

    success = update_csv_with_playoff_data()

    if success:
        print("\n🎉 Playoff data update completed!")
        print("\n📊 Your CSV now includes:")
        print("   • Regular season data")
        print("   • Play-In Tournament games")  
        print("   • Playoff games (all rounds)")
        print("   • Finals games")
    else:
        print("\n❌ Playoff data update failed")