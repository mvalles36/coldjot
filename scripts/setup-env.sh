#!/bin/bash

# Create env directories
mkdir -p env/{development,staging,production}

# Copy example files if they don't exist
for env in development staging production; do
    for type in base web queue; do
        example_file="env/$env/.env.$type.example"
        env_file="env/$env/.env.$type"
        
        if [ -f "$example_file" ] && [ ! -f "$env_file" ]; then
            cp "$example_file" "$env_file"
            echo "Created $env_file from example"
        fi
    done
done

echo "Environment setup complete!"
echo "Please update the environment variables in env/<environment>/* with your actual values"
echo ""
echo "To use a specific environment, set the APP_ENV variable:"
echo "  Development: export APP_ENV=development"
echo "  Staging:     export APP_ENV=staging"
echo "  Production:  export APP_ENV=production" 