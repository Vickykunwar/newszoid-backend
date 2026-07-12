@echo off
node --check "BACKEND\controllers\bizAgentController.js" 1>check_be.txt 2>&1
echo DONE_BE=%errorlevel%>> check_be.txt
