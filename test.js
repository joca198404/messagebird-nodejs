var MessageBird = require ('./');
var messagebird;
var fs = require ('fs');

var accessKey = process.env.MB_ACCESSKEY || null;
var timeout = process.env.MB_TIMEOUT || 5000;
var number = parseInt (process.env.MB_NUMBER, 10) || 31610948431;

var testStart = Date.now ();
var errors = 0;
var queue = [];
var next = 0;
var accessType = null;

var cache = {
  textMessage: {
    originator: 'node-js',
    recipients: [number],
    type: 'sms',
    body: 'Test message from node ' + process.version,
    gateway: 2
  },

  voiceMessage: {
    originator: 'node-js',
    recipients: [number],
    body: 'Hello, this is a test message from node version ' + process.version,
    language: 'en-gb',
    voice: 'female',
    repeat: 1,
    ifMachine: 'continue'
  },

  hlr: {},

  verify: {
    recipient: number
  }
};


function doColor (str, color) {
  var colors = {
    red: '\u001b[1m\u001b[31m',
    green: '\u001b[1m\u001b[32m',
    yellow: '\u001b[1m\u001b[33m',

    reset: '\u001b[0m'
  };

  return colors [color] + str + colors.reset;
}

// Output
function cGood (arg) {
  console.log (doColor ('good', 'green') + ' - ' + arg);
}

function cFail (arg) {
  console.error (doColor ('fail', 'red') + ' - ' + arg);
  errors++;
}

function cInfo (arg) {
  console.log (doColor ('info', 'yellow') + ' - ' + arg);
}

function cDump (arg) {
  console.dir (arg, { depth: null, colors: true });
}

function cError (arg, err) {
  console.error (doColor ('ERR', 'red') + '  - ' + arg + '\n');
  cDump (err);
  console.log ();
  console.error (err.stack);
  console.log ();
  errors++;
}


// handle exits
/* eslint no-process-exit:0 */

process.on ('exit', function () {
  var timing = (Date.now () - testStart) / 1000;

  if (process.env.CIRCLE_ARTIFACTS) {
    fs.rename ('./npm-debug.log', process.env.CIRCLE_ARTIFACTS + '/npm-debug-' + process.versions.node + '.log', function () {});
  }

  console.log ();
  cInfo ('Timing: ' + timing + ' sec');

  if (errors === 0) {
    console.log ('\nDONE, no errors.\n');
    process.exit (0);
  } else {
    console.log ('\n' + doColor ('FAIL', 'red') + ', ' + errors + ' error' + (errors > 1 ? 's' : '') + ' occurred!\n');
    process.exit (1);
  }
});

// prevent errors from killing the process
process.on ('uncaughtException', function (err) {
  cError ('uncaughtException', err);
});

// Queue to prevent flooding
function doNext () {
  next++;
  if (queue [next]) {
    queue [next] ();
  }
}

// doTest( passErr, 'methods', [
//   ['feeds', typeof feeds === 'object']
// ])
function doTest (err, label, tests) {
  var i;
  var testErrors = [];

  if (err instanceof Error) {
    cError (label, err);
    errors++;
  } else {
    for (i = 0; i < tests.length; i++) {
      if (tests [i] [1] !== true) {
        testErrors.push (tests [i] [0]);
        errors++;
      }
    }

    if (testErrors.length === 0) {
      cGood (label);
    } else {
      cFail (label + ' (' + testErrors.join (', ') + ')');
    }
  }

  doNext ();
}


queue.push (function () {
  messagebird.messages.create (
    {},
    function (err) {
      doTest (null, 'error handling', [
        ['type', err instanceof Error],
        ['message', err.message === 'api error'],
        ['errors', err.errors instanceof Array]
      ]);
    }
  );
});


queue.push (function () {
  messagebird.balance.read (function (err, data) {
    doTest (err, 'balance.read', [
      ['type', data instanceof Object],
      ['.amount', data && typeof data.amount === 'number'],
      ['.type', data && typeof data.type === 'string'],
      ['.payment', data && typeof data.payment === 'string']
    ]);
  });
});


queue.push (function () {
  messagebird.messages.create (cache.textMessage, function (err, data) {
    cache.textMessage.id = data && data.id || null;
    doTest (err, 'messages.create', [
      ['type', data instanceof Object],
      ['.id', data && typeof data.id === 'string']
    ]);
  });
});


queue.push (function () {
  if (cache.textMessage.id) {
    messagebird.messages.read (cache.textMessage.id, function (err, data) {
      if (accessType === 'TEST') {
        doTest (null, 'messages.read', [
          ['type', err instanceof Error],
          ['.message', err.message === 'api error'],
          ['.errors', err.errors instanceof Array]
        ]);
      } else {
        doTest (err, 'messages.read', [
          ['type', data instanceof Object],
          ['.body', data && data.body === cache.textMessage.body]
        ]);
      }
    });
  }
});


queue.push (function () {
  messagebird.voice_messages.create (cache.voiceMessage, function (err, data) {
    cache.voiceMessage.id = data && data.id || null;
    doTest (err, 'voice_messages.create', [
      ['type', data instanceof Object],
      ['.id', data && typeof data.id === 'string']
    ]);
  });
});


queue.push (function () {
  if (cache.voiceMessage.id) {
    messagebird.voice_messages.read (cache.voiceMessage.id, function (err, data) {
      if (accessType === 'TEST') {
        doTest (null, 'voice_messages.read', [
          ['type', err instanceof Error],
          ['.message', err.message === 'api error'],
          ['.errors', err.errors instanceof Array]
        ]);
      } else {
        doTest (err, 'voice_messages.read', [
          ['type', data instanceof Object],
          ['.body', data && data.body === cache.voiceMessage.body]
        ]);
      }
    });
  }
});


queue.push (function () {
  messagebird.hlr.create (
    number,
    'The ref',
    function (err, data) {
      cache.hlr.id = data && data.id || null;
      doTest (err, 'hlr.create', [
        ['type', data instanceof Object],
        ['.id', data && typeof data.id === 'string']
      ]);
    }
  );
});


queue.push (function () {
  if (cache.hlr.id) {
    messagebird.hlr.read (cache.hlr.id, function (err, data) {
      if (accessType === 'TEST') {
        doTest (null, 'hlr.read', [
          ['type', err instanceof Error],
          ['.message', err.message === 'api error'],
          ['.errors', err.errors instanceof Array]
        ]);
      } else {
        doTest (err, 'hlr.read', [
          ['type', data instanceof Object],
          ['.msisdn', data && data.msisdn === number]
        ]);
      }
    });
  }
});


queue.push (function () {
  messagebird.verify.create (cache.verify.recipient, function (err, data) {
    cache.verify.id = data && data.id || null;
    doTest (err, 'verify.create', [
      ['type', data instanceof Object],
      ['.id', data && typeof data.id === 'string']
    ]);
  });
});


queue.push (function () {
  if (cache.verify.id) {
    messagebird.verify.read (cache.verify.id, function (err, data) {
      doTest (err, 'verify.read', [
        ['type', data instanceof Object],
        ['.id', data && data.id === cache.verify.id]
      ]);
    });
  }
});


queue.push (function () {
  if (cache.verify.id) {
    messagebird.verify.delete (cache.verify.id, function (err, data) {
      doTest (err, 'verify.delete', [
        ['type', typeof data === 'boolean'],
        ['data', data === true]
      ]);
    });
  }
});


// Start the tests
if (accessKey) {
  accessType = accessKey.split ('_') [0] .toUpperCase ();
  cInfo ('Running test.js');
  cInfo ('Using ' + accessType + ' access key\n');

  messagebird = new MessageBird.client (accessKey, timeout);

  queue[0]();
} else {
  cFail ('MB_ACCESSKEY not set');
  errors++;
}
