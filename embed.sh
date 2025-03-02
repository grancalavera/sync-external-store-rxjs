#!/usr/bin/env bash

llm embed-multi observable-store \
    --files src '**/*ts' \
    -m 3-small
