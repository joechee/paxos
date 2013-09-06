$(function start() {
    
    GLOBAL.log("Starting up network...");
    network = new Network();
    GLOBAL.log("Creating 3 nodes...");
    node1 = new NetworkNode();
    node2 = new NetworkNode();
    node3 = new NetworkNode();
    GLOBAL.log("Connecting them to a network");
    node1.connect(network);
    node2.connect(network);
    node3.connect(network);
    
    
});