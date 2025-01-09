#!/bin/bash
redis-cli KEYS "bull:*" | while read key; do
    echo "Deleting $key"
    redis-cli DEL "$key"
done
