# This is for old keys that are no longer in use
redis-cli KEYS "coldjot:rate:*" | while read key; do redis-cli DEL "$key"; done
