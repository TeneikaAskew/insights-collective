#!/bin/bash

# Script to update console.* calls to use logger utility

# Function to update a single file
update_file() {
    local file="$1"
    local component_name=$(basename "$file" .ts | sed 's/.tsx$//')
    
    echo "Processing: $file"
    
    # Check if logger is already imported
    if ! grep -q "import.*createLogger.*from.*@/utils/logger" "$file"; then
        # Check if the file has any console calls
        if grep -q "console\.\(log\|error\|warn\|debug\|info\)" "$file"; then
            # Add import after the last import statement
            sed -i '/^import.*from/!b; :a; n; /^import.*from/ba; i\import { createLogger } from '\''@/utils/logger'\'';' "$file"
            
            # Add logger creation after imports
            sed -i '/^import { createLogger } from.*@\/utils\/logger/a\\nconst logger = createLogger('"'$component_name'"');' "$file"
            
            # Replace console calls
            sed -i 's/console\.log(/logger.log(/g' "$file"
            sed -i 's/console\.error(/logger.error(/g' "$file"
            sed -i 's/console\.warn(/logger.warn(/g' "$file"
            sed -i 's/console\.debug(/logger.debug(/g' "$file"
            sed -i 's/console\.info(/logger.info(/g' "$file"
            
            echo "  ✓ Updated $file"
        else
            echo "  - No console calls found in $file"
        fi
    else
        # Just replace console calls if logger is already imported
        if grep -q "console\.\(log\|error\|warn\|debug\|info\)" "$file"; then
            sed -i 's/console\.log(/logger.log(/g' "$file"
            sed -i 's/console\.error(/logger.error(/g' "$file"
            sed -i 's/console\.warn(/logger.warn(/g' "$file"
            sed -i 's/console\.debug(/logger.debug(/g' "$file"
            sed -i 's/console\.info(/logger.info(/g' "$file"
            echo "  ✓ Updated console calls in $file (logger already imported)"
        else
            echo "  - Already updated: $file"
        fi
    fi
}

# Find all TypeScript files with console calls
echo "Finding files with console calls..."
files=$(grep -r "console\.\(log\|error\|warn\|debug\|info\)" --include="*.ts" --include="*.tsx" /app/src | cut -d: -f1 | sort -u)

total=$(echo "$files" | wc -l)
current=0

echo "Found $total files to update"
echo "=========================="

for file in $files; do
    ((current++))
    echo "[$current/$total]"
    update_file "$file"
    echo ""
done

echo "=========================="
echo "Update complete!"