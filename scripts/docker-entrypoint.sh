#!/bin/bash
set -e

if [ "$1" = "--help" ]; then
	echo "--help"
	echo "--version"
	exit
fi

if [ "$1" = "--version" ]; then
	node ./ver.js
	exit
fi

if [ "$1" = "island" ]; then
	export CONTAINER_TYPE=`grep "name" package.json |  grep -Eo "[a-z]+((-[a-z]+)?)+" | grep -v name`
	echo "start $CONTAINER_TYPE"
	node ./ver.js
	exec node dist/app.js ${CONTAINER_TYPE}
fi

exec "$@"

