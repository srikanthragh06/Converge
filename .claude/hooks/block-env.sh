#!/usr/bin/env bash
input=$(cat)
paths=$(echo "$input" | python3 -c "
import sys, json, os
d = json.load(sys.stdin)
i = d.get('tool_input', {})
for key in ('file_path', 'path', 'pattern', 'command'):
    print(i.get(key, ''))
")
while IFS= read -r p; do
  if [ "$(basename "$p")" = ".env" ]; then
    echo '{"decision":"block","reason":"Access to .env files is blocked."}'
    exit 0
  fi
done <<< "$paths"
