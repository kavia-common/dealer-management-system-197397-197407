#!/bin/bash
cd /home/kavia/workspace/code-generation/dealer-management-system-197397-197407/dealers_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

