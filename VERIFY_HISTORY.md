How to verify server/node_modules has been removed from git history

1) Clone a fresh copy of the repo into a temporary folder (mirror clone is optional):

   git clone https://github.com/DP26112/fasting-tracker.git cleaned-repo

2) Change into the repo and run:

   # check for any commits that touch server/node_modules
   cd cleaned-repo
   git rev-list --all -- server/node_modules | head -n 5

   # If nothing is printed, the path no longer exists in history.

3) Check repository size to ensure it is smaller after rewrite:

   git count-objects -vH

Notes:
- If the command in step 2 prints any commit hashes, some refs still reference that path. That can happen if local refs were not updated before the rewrite or tags/branches still reference old history.
- To fully ensure a local clone has no references, clone into a new directory and run step 2 there.

If you'd like, I can run these verification steps now by cloning the remote into a temporary folder in this environment and reporting the results.
