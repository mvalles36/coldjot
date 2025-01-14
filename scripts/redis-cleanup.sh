#!/bin/bash
redis-cli KEYS "coldjot:*:*" | while read key; do
    echo "Deleting $key"
    redis-cli DEL "$key"
done
