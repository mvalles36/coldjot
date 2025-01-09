#!/bin/bash
redis-cli KEYS "bull:*" | while read key; do redis-cli DEL "$key"; done
redis-cli KEYS "coldjot:queue:*" | while read key; do redis-cli DEL "$key"; done
redis-cli KEYS "coldjot:*:*" | while read key; do redis-cli DEL "$key"; done
