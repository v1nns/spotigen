module.exports.debug = function(msg) {
    console.log("[DEBUG]", msg);
}

module.exports.info = function(msg) {
    console.log("[INFO ]", msg);
}

module.exports.error = function(msg) {
    console.log("[ERROR]", msg.message? msg.message : msg);
}