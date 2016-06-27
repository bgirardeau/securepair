# native modules need to be rebuilt with nw-gyp
cd node_modules/xpc-connection/ && nw-gyp rebuild --target=0.12.3;
cd node_modules/bluetooth-hci-socket/ && nw-gyp rebuild --target=0.12.3;
exit 0
