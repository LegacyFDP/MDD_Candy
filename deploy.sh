#!/bin/bash
set -e

echo "Pulling latest code..."
git fetch --all
git reset --hard origin/develop

echo "Installing dependencies..."
npm install --production

echo "Restarting service..."
sudo systemctl restart mdd_candy.service

echo "Deployment complete."

