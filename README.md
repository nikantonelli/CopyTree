Portfolio Item Copy
===================

## Overview

Find all the child items from a root Portfolio Item and replicate as much as possible into a new item that
might be in the same or different workspace.

Portofolio item names might differ so the app tries to use the ordinal level of the item instead.

## BE WARNED!

This app relies on your local memory. If you try to copy something too big, it will fail.

This app is single threaded and can be slow. If you try to copy something too big, you will be bored to death.

This app can issue many update requests. If you try to copy something too big, you will run out of network resources.

## TODO

1. DONE. Add the source FormattedID to the destination item in the notes field or add a discussion entry.
2. Collate revision history and add as an attachment
3. DONE. Check model equality between source and destination
3. Find all dependencies are re-create them
4. Find all Milestones and re-create them
5. DONE. Copy all tags over
6. Copy over timeboxes
7. Add custom field mapping
