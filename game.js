var _ = require('underscore');
var cards = require('./cards.js');
var config = require('./config.js');

var gameList = [];

function getDeck() {
  return cards.getDeck();
}

function removeFromArray(array, item) {
  var index = array.indexOf(item);
  if(index !== -1) {
    array.splice(index, 1);
  }
}

function removeElementsFromArray(array, items) {
  return _.difference(array, items);
}

function list() {
  return toInfo(_.filter(gameList, function(x) {
    // This is used to determine what games are shown in the lobby
    return x.players.length < config.maxPlayers;
  }));
}

function listAll() {
  return toInfo(gameList);
}

function toInfo(fullGameList) {
  return _.map(fullGameList, function(game) {
    return {
      id: game.id,
      name: game.name,
      players: game.players.length,
      maxPlayers: game.maxPlayers
    };
  });
}

function addGame(game) {
  game.players = [];
  game.history = [];
  game.isOver = false;
  game.winnerId = null;
  game.isStarted = false;
  game.deck = cards.getDeckFromSets(game.sets, game.expansions);
  game.currentBlackCard = "";
  game.whiteCardsRequired = 0;
  game.isReadyForScoring = false;
  game.isReadyForReview = false;
  game.pointsToWin = config.pointsToWin;
  game.maxPlayers = config.maxPlayers;
  gameList.push(game);
  return game;
}

function getGame(gameId) {
    return _.find(gameList, function(x) { return x.id === gameId; }) || undefined;
}

function joinGame(game, player) {
    var joiningPlayer = {
    id: player.id,
    name: player.name,
    isReady: false,
    cards : [],
    selectedWhiteCardId: null,
    selectedWhiteCardIds: [],
    awesomePoints: 0,
    isCzar: false
    };

    for(var i = 0; i < config.whiteCardsPerHand; i++) {
        drawWhiteCards(game, joiningPlayer, 1);
    }

    game.players.push(joiningPlayer);

    // Need to add a start game button, not just start automatically
    if(game.players.length === config.minPlayers) {
        if(!game.isStarted){
            startGame(game);
        } else {
            //someone may have dropped and rejoined. If it was the Czar, we need to re-elect the re-joining player
            var currentCzar = _.find(game.players, function(p) {
                return p.isCzar === true;
            });
            if(!currentCzar){
                game.players[game.players.length - 1].isCzar = true;
            }
        }
    }

    return game;
}

function departGame(gameId, playerId) {
    var game = getGame(gameId);
    if(game){
        console.info('depart game: ' + game.name);
        var departingPlayer = _.find(game.players, function(p){
            return p.id === playerId;
        });
        removeFromArray(game.players, departingPlayer);
        if(game.players.length === 0){
            //kill the game
            removeFromArray(gameList, game);
        }
    }
}

function startGame(game) {
  game.isStarted = true;
  setCurrentBlackCard(game);
  game.players[0].isCzar = true;
}

function selectCardCzar(game) {
  for (var i = 0; i < game.players.length; i++) {
    if (game.players[i].isCzar === true) {
      game.players[i].isCzar = false;
      var nextCzar = (i + 1) % game.players.length;
      game.players[nextCzar].isCzar = true;
      game.players[nextCzar].isReady = false;
      return;
    }
  }
}

function roundEnded(game) {
  game.winnerId = null;
  game.winningPlayerId = null;
  game.isReadyForScoring = false;
  game.isReadyForReview = false;

  setCurrentBlackCard(game);

  _.each(game.players, function(player) {
    if(!player.isCzar) {
      player.cards = removeElementsFromArray(player.cards, player.selectedWhiteCardIds);
      //Build their deck back to required size
      drawWhiteCards(game, player, config.whiteCardsPerHand - player.cards.length);
    }

    player.isReady = false;
    player.selectedWhiteCardIds = [];
  });

  // create a function to rotate through the players
  selectCardCzar(game);

  if(game.isOver){
    _.map(game.players, function(p) {
        p.awesomePoints = 0;
    });
    game.isOver = false;
  }
}

function drawWhiteCards(game, player, numberCards) {
  "use strict";
  for (let i = 0; i < numberCards; i++) {
    var whiteIndex = Math.floor(Math.random() * game.deck.white.length);
    player.cards.push(game.deck.white[whiteIndex]);
    game.deck.white.splice(whiteIndex, 1);
  }
}

function setCurrentBlackCard(game) {
  var index = Math.floor(Math.random() * game.deck.black.length);
  game.currentBlackCard = game.deck.black[index].text
  game.whiteCardsRequired = game.deck.black[index].pick;
  game.deck.black.splice(index, 1);
}

function getPlayer(gameId, playerId) {
  var game = getGame(gameId);
  return _.find(game.players, function(x) { return x.id === playerId; });
}

function readyForNextRound(gameId, playerId) {
  var player = getPlayer(gameId, playerId);
  player.isReady = true;

  var game = getGame(gameId);
  var allReady = _.every(game.players, function(x) {
    return x.isReady;
  });

  if(allReady) {
    roundEnded(game);
  }
}

function selectCard(gameId, playerId, whiteCardId, index) {
  var player = getPlayer(gameId, playerId);
  player.selectedWhiteCardIds[index] = whiteCardId;
  player.isReady = false;

  var game = getGame(gameId);

  var readyPlayers = _.filter(game.players, function (x) {
    return x.selectedWhiteCardIds.length === game.whiteCardsRequired;
  });

  if(readyPlayers.length === game.players.length - 1) {
    game.isReadyForScoring = true;
  }
}

function selectWinner(gameId, playerId) {
  var player = getPlayer(gameId, playerId);
  var game = getGame(gameId);
  game.winningPlayerId = playerId;
  game.isReadyForReview = true;
  player.awesomePoints = player.awesomePoints + 1;
  game.history.push({ black: game.currentBlackCard, white: player.selectedWhiteCardIds, winner: player.name });
  if(player.awesomePoints === game.pointsToWin) {
    game = getGame(gameId);
    game.isOver = true;
    game.winnerId = playerId;
  }
}

function reset(){
  gameList = [];
}

exports.list = list;
exports.listAll = listAll;
exports.addGame = addGame;
exports.getGame = getGame;
exports.getPlayer = getPlayer;
exports.joinGame = joinGame;
exports.departGame = departGame;
exports.readyForNextRound = readyForNextRound;
exports.reset = reset;
exports.roundEnded = roundEnded;
exports.selectCard = selectCard;
exports.selectWinner = selectWinner;
exports.removeFromArray = removeFromArray;
exports.getDeck = getDeck;
