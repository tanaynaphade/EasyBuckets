#!/usr/bin/env python3
"""
NBA Game Log Data Updater - WITH OPPONENT DATA
Updated version that properly extracts opponent team information from NBA API
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

try:
    from tqdm import tqdm
    TQDM_AVAILABLE = True
except ImportError:
    TQDM_AVAILABLE = False

def extract_opponent_from_matchup(matchup, team_abbrev):
    """
    Extract opponent from MATCHUP string
    Examples: 'LAL @ BOS', 'GSW vs. LAC'
    """
    if pd.isna(matchup) or not matchup:
        return 'UNK'

    try:
        matchup = matchup.strip()

        # Handle "@ " format (away games)  
        if ' @ ' in matchup:
            teams = matchup.split(' @ ')
            away_team = teams[0].strip()
            home_team = teams[1].strip()

            if away_team == team_abbrev:
                return home_team
            elif home_team == team_abbrev:
                return away_team

        # Handle "vs. " format (home games)
        elif ' vs. ' in matchup:
            teams = matchup.split(' vs. ')
            home_team = teams[0].strip()
            away_team = teams[1].strip()

            if home_team == team_abbrev:
                return away_team
            elif away_team == team_abbrev:
                return home_team

        # Fallback: extract any 3-letter team codes
        team_codes = re.findall(r'\b[A-Z]{3}\b', matchup)
        for code in team_codes:
            if code != team_abbrev:
                return code

        return 'UNK'

    except Exception as e:
        print(f"Error parsing matchup '{matchup}': {e}")
        return 'UNK'

def calculate_game_score(row):
    """Calculate Game Score using the specified formula"""
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
    """Convert minutes from MM:SS format to decimal"""
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

def get_nba_data_with_opponents(start_date, end_date=None):
    """
    Get NBA data including opponent information extracted from MATCHUP column
    """
    if not NBA_API_AVAILABLE:
        print("❌ NBA API not available")
        return pd.DataFrame()

    print(f"🔍 Fetching NBA data from {start_date} with opponent extraction...")

    if end_date is None:
        end_date = datetime.now().strftime('%Y-%m-%d')

    try:
        current_season = get_current_season()
        print(f"📅 Current season: {current_season}")

        # Get player game logs
        print("⏳ Requesting data from NBA.com...")
        gamelog = leaguegamelog.LeagueGameLog(
            season=current_season,
            season_type_all_star='Regular Season',
            player_or_team_abbreviation='P'
        )

        time.sleep(2)  # Rate limiting
        df = gamelog.get_data_frames()[0]

        print(f"📊 Retrieved {len(df)} total game log records")
        print(f"🔍 Available columns: {len(df.columns)} columns")

        if df.empty:
            print("❌ No data retrieved")
            return pd.DataFrame()

        # Filter by date range
        df['GAME_DATE'] = pd.to_datetime(df['GAME_DATE'])
        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)

        df_filtered = df[(df['GAME_DATE'] >= start_dt) & (df['GAME_DATE'] <= end_dt)]
        print(f"🗓️ Filtered to {len(df_filtered)} records between {start_date} and {end_date}")

        if df_filtered.empty:
            print("⚠️ No data in specified date range")
            return pd.DataFrame()

        # Extract opponent information from MATCHUP column
        if 'MATCHUP' in df_filtered.columns:
            print("✅ MATCHUP column found - extracting opponents...")
            df_filtered = df_filtered.copy()  # Avoid SettingWithCopyWarning
            df_filtered['Opp'] = df_filtered.apply(
                lambda row: extract_opponent_from_matchup(row['MATCHUP'], row['TEAM_ABBREVIATION']), 
                axis=1
            )

            # Show sample of opponent extraction
            print("\n📋 Sample opponent extraction:")
            sample = df_filtered[['PLAYER_NAME', 'TEAM_ABBREVIATION', 'MATCHUP', 'Opp']].head(3)
            for _, row in sample.iterrows():
                print(f"   {row['PLAYER_NAME'][:15]:15} | {row['TEAM_ABBREVIATION']} | {row['MATCHUP']:12} -> {row['Opp']}")
        else:
            print("❌ MATCHUP column not found - using placeholder")
            df_filtered['Opp'] = 'UNK'

        # Map NBA API columns to your CSV format
        result_df = pd.DataFrame()

        column_mapping = {
            'PLAYER_NAME': 'Player',
            'TEAM_ABBREVIATION': 'Tm',
            'Opp': 'Opp',  # Our extracted opponent
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
            if old_col in df_filtered.columns:
                result_df[new_col] = df_filtered[old_col]

        # Convert date format
        result_df['Data'] = result_df['Data'].dt.strftime('%Y-%m-%d')

        # Convert minutes
        if 'MP' in result_df.columns:
            result_df['MP'] = result_df['MP'].apply(convert_minutes)

        # Fill NaN values and convert data types
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

        print(f"✅ Successfully processed {len(result_df)} records with opponents")

        # Summary of opponent data
        if not result_df.empty:
            unique_opponents = result_df['Opp'].value_counts()
            print(f"\n🎯 Opponent Summary:")
            print(f"   Unique opponents found: {result_df['Opp'].nunique()}")
            print(f"   Most common opponents: {dict(unique_opponents.head(3))}")
            if 'UNK' in unique_opponents:
                print(f"   ⚠️  Unknown opponents: {unique_opponents['UNK']} records")

        return result_df

    except Exception as e:
        print(f"❌ Error fetching NBA data: {e}")
        return pd.DataFrame()

def update_nba_csv_with_opponents(csv_path='nba_game_player_data.csv', output_path=None):
    """
    Main function to update NBA CSV with opponent data included
    """
    print("🏀 NBA Data Updater with Opponent Extraction")
    print("=" * 55)

    # Load existing data
    try:
        existing_df = pd.read_csv(csv_path)
        print(f"📁 Loaded existing data: {len(existing_df)} records")

        # Get latest date
        existing_df['Data'] = pd.to_datetime(existing_df['Data'])
        latest_date = existing_df['Data'].max()
        start_date = (latest_date + timedelta(days=1)).strftime('%Y-%m-%d')

        print(f"📅 Latest date in data: {latest_date.strftime('%Y-%m-%d')}")
        print(f"🔄 Will fetch new data starting from: {start_date}")

    except FileNotFoundError:
        print(f"❌ File {csv_path} not found!")
        return False
    except Exception as e:
        print(f"❌ Error reading existing data: {e}")
        return False

    # Get new data with opponents
    new_data = get_nba_data_with_opponents(start_date)

    if new_data.empty:
        print("❌ No new data could be retrieved")
        return False

    print(f"\n📊 Retrieved {len(new_data)} new records with opponents")

    # Ensure column consistency
    expected_columns = list(existing_df.columns)

    # Add missing columns
    for col in expected_columns:
        if col not in new_data.columns:
            if col in ['FG%', '3P%', 'FT%', 'GmSc', 'MP']:
                new_data[col] = 0.0
            elif col in ['Opp', 'Player', 'Tm', 'Res', 'Data']:
                new_data[col] = 'Unknown'
            else:
                new_data[col] = 0

    # Reorder columns
    new_data = new_data[expected_columns]

    # Convert date back to string for consistency
    existing_df['Data'] = existing_df['Data'].dt.strftime('%Y-%m-%d')

    # Combine data
    combined_df = pd.concat([existing_df, new_data], ignore_index=True)
    combined_df = combined_df.drop_duplicates(subset=['Player', 'Data', 'Tm'], keep='last')

    print(f"📈 Combined dataset: {len(combined_df)} total records")
    print(f"➕ Added {len(combined_df) - len(existing_df)} new records")

    # Save updated data
    if output_path is None:
        output_path = csv_path

    try:
        combined_df.to_csv(output_path, index=False)
        print(f"✅ Updated data saved to: {output_path}")

        # Show summary
        if len(new_data) > 0:
            print("\n📋 Summary of new data:")
            print(f"   Date range: {new_data['Data'].min()} to {new_data['Data'].max()}")
            print(f"   Unique players: {new_data['Player'].nunique()}")
            print(f"   Unique teams: {new_data['Tm'].nunique()}")
            print(f"   Unique opponents: {new_data['Opp'].nunique()}")

            # Show opponent breakdown
            opp_counts = new_data['Opp'].value_counts()
            print(f"   Top opponents: {dict(opp_counts.head(5))}")

        return True

    except Exception as e:
        print(f"❌ Error saving data: {e}")
        return False

if __name__ == "__main__":
    print("🏀 NBA Data Updater with Opponent Extraction")
    print("=" * 50)

    print("\n" + "=" * 50)

    # Check if NBA API is available
    if not NBA_API_AVAILABLE:
        print("❌ NBA API not installed. Please install with:")
        print("   pip install nba-api")
        exit(1)

    # Run the update
    success = update_nba_csv_with_opponents()

    if success:
        print("\n🎉 Update completed successfully with opponents!")
        print("\n📊 Your CSV now includes:")
        print("   • All existing data")
        print("   • New NBA player game logs")  
        print("   • Proper opponent team abbreviations")
        print("   • Calculated Game Scores")
    else:
        print("\n❌ Update failed. Check errors above.")

    print("\n" + "=" * 50)