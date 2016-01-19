function lotteryProcessor(pathToLibs){
    var amqp = require('amqplib');
    var log = require(pathToLibs + 'log')(module);
    var db = require(pathToLibs + 'db/mongoose');
    var request = require('request');

    var Lottery = require(pathToLibs + 'model/lottery');

    function storeData(data) {
        var lottery = new Lottery({
            draw_date : data.draw_date,
            winning_numbers : data.winning_numbers,
            multiplier : data.multiplier
        });

        lottery.save(function (err) {
            if (!err) {
                log.info("New lottery created with id: %s", lottery.id);
            } else {
                log.error('Internal error(%d): %s', err.message);
            }
        });
    }

    function fetch(cb) {
        var _data;
        var _position = 0;
        var _increment = 10;

        function getStoredItemsNumber(err, count) {
            if(err) return console.error(err);
            _position = count;
            
            allReady();
        }

        function countItems() {
            Lottery.count({}, getStoredItemsNumber);
        }

        function allReady() {
            var _end = _position + _increment;

            for(i = _position; i <= _end; i += 1) {
                storeData(_data[i]);
            }

            cb(null, 'Done');
        }

        function dataReady() {
            countItems(getStoredItemsNumber);
        }

        function getData(data) {
            _data = JSON.parse(data);
            dataReady();
        }

        function fetchData(callback) {
            request.get({ url : 'http://data.ny.gov/resource/d6yy-54nr.json' }, 
                function (error, response, body) {
                    if (error) { return console.error(error) }
                    if (response.statusCode === 200) {
                        callback(body);
                    }
                }
            );
        }
        
        fetchData(getData);
    }

    function get(cb) {
        Lottery.find({}, function (err, lottery) {
            if(!lottery) {
                cb(null, null);
            }
            
            if (err) {
                cb(err);
            } else {
                cb(null, lottery);
            }
        }.bind(this));
    }


    amqp.connect('amqp://localhost').then(function(conn) {
        process.once('SIGINT', function() { conn.close(); });

        return conn.createChannel().then(function(ch) {
            var q = 'rpc_queue';
            var ok = ch.assertQueue(q, { durable: false });
            var ok = ok.then(function() {
                ch.prefetch(1);
                return ch.consume(q, sendReply);
            });

            function sendReply(msg) {
                var _msg = msg.content.toString();
                console.log(_msg);

                function reply(err, data) {
                    if (err) {
                        return console.err(err);
                    }

                    ch.sendToQueue(msg.properties.replyTo,
                        new Buffer(JSON.stringify(data)),
                        { correlationId: msg.properties.correlationId });
                    ch.ack(msg);
                }

                if(_msg === 'fetch') {
                    fetch(reply.bind(this));
                } else if(_msg === 'get') {
                    get(reply.bind(this));
                }
            }

            return ok.then(function() {
                console.log(' [x] Awaiting RPC requests');
            });
        });
    }).then(null, console.warn);
}

module.exports = lotteryProcessor;