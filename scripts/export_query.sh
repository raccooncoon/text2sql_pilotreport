#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CONFIG_FILE="$SCRIPT_DIR/db_config.env"

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found at $CONFIG_FILE"
    echo "Please copy db_config.env.example to db_config.env and set your credentials."
    exit 1
fi

# Load configuration
source "$CONFIG_FILE"

# Check for required variables
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo "Error: One or more database configuration variables are missing in $CONFIG_FILE"
    exit 1
fi

echo "Starting export from $DB_HOST:$DB_PORT/$DB_NAME..."
echo "Query: $EXPORT_QUERY"
echo "Query: $EXPORT_QUERY"

# Append timestamp to output filename
# Extract filename and extension
FILENAME=$(basename -- "$OUTPUT_FILE")
EXTENSION="${FILENAME##*.}"
FILENAME="${FILENAME%.*}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create data directory if it doesn't exist
DATA_DIR="$SCRIPT_DIR/../src/data"
mkdir -p "$DATA_DIR"

# Update OUTPUT_FILE with timestamp and path
if [[ "$OUTPUT_FILE" == *.* ]]; then
  OUTPUT_FILE="$DATA_DIR/${FILENAME}_${TIMESTAMP}.${EXTENSION}"
else
  OUTPUT_FILE="$DATA_DIR/${OUTPUT_FILE}_${TIMESTAMP}"
fi

echo "Output File: $OUTPUT_FILE"

# Helper function to find psql
find_psql() {
    if command -v psql &> /dev/null; then
        echo "psql"
        return 0
    fi

    # Common Homebrew paths for libpq (keg-only)
    local paths=(
        "/opt/homebrew/opt/libpq/bin/psql"
        "/usr/local/opt/libpq/bin/psql"
    )

    for path in "${paths[@]}"; do
        if [ -x "$path" ]; then
            echo "$path"
            return 0
        fi
    done

    return 1
}

PSQL_CMD=$(find_psql)

# Check if psql is installed
if [ -n "$PSQL_CMD" ]; then
    echo "Using PostgreSQL client: $PSQL_CMD"
    export PGPASSWORD="$DB_PASSWORD"
    "$PSQL_CMD" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY ($EXPORT_QUERY) TO '$OUTPUT_FILE' WITH CSV HEADER"
    EXIT_CODE=$?
    unset PGPASSWORD
elif command -v docker &> /dev/null; then
    # Check if Docker daemon is running
    if ! docker info > /dev/null 2>&1; then
        echo "Error: Docker is installed but not running."
        echo "Please start Docker Desktop and try again."
        echo ""
        echo "Alternatively, you can install 'psql' via Homebrew:"
        echo "  brew install libpq"
        echo "  brew link --force libpq"
        exit 1
    fi

    echo "Local psql not found. Using Docker (postgres:alpine)..."
    # Using Docker to run psql. We redirect stdout to the output file.
    # Note: \COPY TO STDOUT is used to stream data to host
    docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:alpine psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY ($EXPORT_QUERY) TO STDOUT WITH CSV HEADER" > "$OUTPUT_FILE"
    EXIT_CODE=$?
else
    echo "Error: Neither 'psql' nor 'docker' is found."
    echo "Please install PostgreSQL client (libpq) or Docker."
    if command -v brew &> /dev/null; then
        echo "You can install libpq with Homebrew:"
        echo "  brew install libpq"
        echo "  brew link --force libpq"
    fi
    exit 1
fi

# Check exit status
if [ $EXIT_CODE -eq 0 ]; then
    echo "Export completed successfully: $OUTPUT_FILE"
else
    echo "Export failed."
    exit 1
fi
