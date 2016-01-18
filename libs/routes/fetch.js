var express = require('express');
var router = express.Router();
var libs = process.cwd() + '/libs/';
var log = require(libs + 'log')(module);
var amqp = require('amqplib');
var basename = require('path').basename;
var when = require('when');
var defer = when.defer;
var uuid = require('node-uuid');

router.get('/', function(req, res) {
	amqp.connect('amqp://localhost').then(function(conn) {
		return when(conn.createChannel().then(function(ch) {
			var answer = defer();
			var corrId = uuid();

			function maybeAnswer(msg) {
				if (msg.properties.correlationId === corrId) {
					answer.resolve(msg.content.toString());
				}
			}

			var ok = ch.assertQueue('', { exclusive: true })
			  .then(function(qok) { return qok.queue; });

			ok = ok.then(function(queue) {
			  return ch.consume(queue, maybeAnswer, { noAck: true })
			    .then(function() { return queue; });
			});

			ok = ok.then(function(queue) {
			  ch.sendToQueue('rpc_queue', new Buffer('fetch'), {
			    correlationId: corrId, replyTo: queue
			  });

			  return answer.promise;
			});

			return ok.then(function(response) {
				res.end(response);
				console.log(' [.] And response is %s', response);
			});
		})).ensure(function() { conn.close(); });
	}).then(null, console.warn);
});

module.exports = router;