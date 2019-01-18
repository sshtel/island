#!/bin/bash
set -e

if [ "$1" = "--help" ]; then
	echo "--help"
	echo "--version"
	echo "--rpc"
	echo "--endpoint"
	echo "--env"
	exit
fi

if [ "$1" = "--version" ]; then
	node ./ver.js
	exit
fi

if [ "$1" = "--rpc" ]; then
	node info.js rpc
	exit
fi

if [ "$1" = "--endpoint" ]; then
	node info.js endpoint
	exit
fi

if [ "$1" = "--env" ]; then
	node info.js env
	exit
fi

if [ "$1" = "island" ]; then
	export CONTAINER_TYPE=`grep "name" package.json | head -1 | grep -Eo "[a-z]+((-[a-z]+)?)+" | grep -v name`
	echo "start $CONTAINER_TYPE"
	node ./ver.js
	exec node dist/app.js ${CONTAINER_TYPE}
fi

exec "$@"

