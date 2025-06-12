# Use a Node.js base image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /app

# Install claude-code globally
RUN npm install -g @anthropic-ai/claude-code

# Expose any necessary ports if claude-code runs a server (unlikely for a CLI tool, but good practice)
# EXPOSE 8000

# Set the entrypoint to run claude-code, but allow overriding for interactive use
ENTRYPOINT ["claude"]
CMD ["--help"] 