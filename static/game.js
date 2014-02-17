function game_init () {
	var serverLocation = window.location.origin,
		player = null,
		playerColors = null,
		gameId = null,
		lastState = null,
		playerIsGameHost = false,
		selectedImage = null,
		votedImage = null,
		LOOP_TIMEOUT = 1000,
		running = true;

	initLogin();

	function initLogin() {
		var html =
			'<div class="play-game">' +
				'<label for="player-name-field" id="player-name-label">Chose Your Name</label>' +
				'<input id="player-name-field" type="text" />' +
				'<button id="play-btn" class="btn">Play Game</button>' +
			'</div>',
		play_btn = null;

		$('body').html(html);
		gameId = getQueryVariable('game_id');
		play_btn = document.getElementById('play-btn');

		playerIsGameHost = typeof(gameId) === 'undefined';

		$('#play-btn').click(function(event) {
			var playerNameField = $('#player-name-field'),
				target = $(event.target);
			if (playerNameField.val() !== '') {
				disableButton(target);
				player = playerNameField.val();
				setUpGame();
			}
		});

		$('#player-name-field').keyup(function (event) {
			if (event.keyCode == 13) {
				$('#play-btn').click();
			}
		}).focus();
	}

	function setUpGame() {
		if (playerIsGameHost) {
			$.ajax({
				type: "GET",
				url: serverLocation + '/create/' + player,
				dataType: 'json',
				success: function (data) {
					gameId = data.game_id;
					gameMain();
				}
			});
		} else {
			$.ajax({
				type: "POST",
				url: serverLocation + '/join',
				data: JSON.stringify({'game_id': gameId, 'player': player}),
				dataType: 'json',
				success: function (data) {
					gameMain();
				},
				error: function () {
					$('.play-game').empty();
					$('.play-game').append('<div>Unknown game.</div>');
					$('.play-game').append('<a href="' + window.location.href.split('?')[0] + '">Create a new game.');
				}
			});
		}
	}

	function gameMain() {
		if (!running) {
			return;
		}

		processCurrentState();
		window.setTimeout(gameMain, LOOP_TIMEOUT);
	}

	function processCurrentState() {
		var currentState = null,
			currentStateData = null;

		$.ajax({
			type: "POST",
			data: JSON.stringify({"game_id": gameId, 'player': player}),
			dataType: 'json',
			url: serverLocation + '/state',
			success: function (data) {
				currentState = data.state;
				currentStateData = data;
			},
			error: function () {
				running = false;
			},
			async: false
		});

		if (currentState === 'joining') {
			setUpPlayerColors(currentStateData);
			if (currentState !== lastState) {
				setUpJoining(currentStateData);
			}
			refreshPlayerList(currentStateData);
			refreshStartButtonState(currentStateData);
		} else if (currentState === 'start_round') {
			if (currentState !== lastState) {
				setUpStartRound(currentStateData);
			}
		} else if (currentState === 'matching') {
			if (currentState !== lastState) {
				setUpMatching(currentStateData);
			}
		} else if (currentState === 'voting') {
			if (currentState !== lastState) {
				setUpVoting(currentStateData);
			}
		} else if (currentState === 'vote_done') {
			if (currentState !== lastState) {
				setUpVoteDone(currentStateData);
			}
			refreshScores(currentStateData);
		} else if (currentState === 'game_over') {
			setUpGameOver(currentStateData);
			running = false;
		}
		lastState = currentState;
	}

	function refreshStartButtonState(stateData) {
		var startButton = $('#start-btn');

		if (!playerIsGameHost) {
			startButton.attr('disabled', 'disabled').html('Waiting for host to start...');
		} else if (stateData.players.length < 3) {
			startButton.attr('disabled', 'disabled').html('Need at least 3 players to start');
		} else {
			startButton.removeAttr('disabled').html('Start Game');
		}
	}

	function refreshPlayerList (stateData) {
		var ul = $('#joining ul');
		ul.empty();

		if (ul) {
			$.each(stateData.players, function (i, el) {
				var li = $('<li><div class="dot" style="background-color:' + playerColors[el] + ';"></div>' + el + '</li>');
				ul.append(li);
			});
		}
	}

	function setUpJoining (stateData) {
		var shareLink = window.location.href.split('?')[0] + '?game_id=' + gameId;

		$('body').html('<div class="container"><div id="joining"><h1>New Game</h1><ul></ul></div></div>');
		$('#joining h1').after('<label for="share-link">Share this link:</label><input type="text" readonly="readonly" id="share-link" value="' + shareLink + '"/>');
		$('#joining ul').before('<h2>Players waiting:</h2>');

		$('.container').prepend('<button id="start-btn" class="btn">Start Game</button>');

		$('#share-link').click(function () {
			$(this).select();
		}).click();

		startButton = $('#start-btn');
		if (startButton) {
			startButton.click(function () {
				disableButton(startButton, startButton.html());
				$.ajax({
					type: "POST",
					url: serverLocation + '/end_joining',
					data: JSON.stringify({'game_id': gameId, 'player': player}),
					dataType: 'json'
				});
			});
		}
	}

	function setUpPlayerColors(stateData) {
		playerColors = {};

		$.each(stateData.players, function (i, el) {
			playerColors[el] = hashStringToColor(el);
		});

		function hashStringToColor(str) {
			var hash = djb2(str);
			var r = (hash & 0xFF0000) >> 16;
			var g = (hash & 0x00FF00) >> 8;
			var b = hash & 0x0000FF;
			return "#" + ("0" + r.toString(16)).substr(-2) + ("0" + g.toString(16)).substr(-2) + ("0" + b.toString(16)).substr(-2);
		}

		function djb2(str){
			var hash = 5381;
			for (var i = 0; i < str.length; i++) {
				hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
			}
			return hash;
		}
	}

	function displayImagesStartRound(stateData) {
		$('#game').prepend('<div id="match-image" class="images"><div class="images-wrapper"></div></div>');
		$.ajax({
			type: "POST",
			url: serverLocation + '/get_images',
			data: JSON.stringify({'game_id': gameId, 'player': player}),
			dataType: 'json',
			success: function (data) {
				var images_wrapper = $('#match-image .images-wrapper');
				if (data.status === 'ok') {
					$.each(data.response, function (i, el) {
						var img = $('<img src="' + el + '" />');
						var image_overlay = $('<div class="image-overlay"></div>');
						image_overlay.prepend(img);
						images_wrapper.append(image_overlay);

						img.click(function(event) {
							var target = $(event.target);
							if (target.is("img")) {
								images_wrapper.children().each(function(j, el) {
									$(el).removeClass('selected');
								});

								target.parent().addClass('selected');
								selectedImage = target.attr('src');
							}
						});
					});
				}
			},
			async: false
		});
	}

	function setUpStartRound (stateData) {
		var text = '';

		$('body').html('<div class="container"><div id="game"></div></div>');
		displayImagesStartRound(stateData);

		if (stateData.player_to_act === player) {
			text = 'You are the describing player. Choose an image and write a description of it!';
			$('#game').prepend('<div class="info">' + text + '</div>');
			$('#game').append('<div id="description-input"><input type="text" />' +
				'<button class="btn" id="desc-btn">Go!</button></div>');
			$('#game #desc-btn').click(function (event) {
				var input_description = $('#description-input input[type=text]'),
					target = $(event.target),
					warning_text = '';
				if (input_description.val() && selectedImage) {
					disableButton(target);
					$.ajax({
						type: "POST",
						data: JSON.stringify({'game_id': gameId,
							'player': player,
							'image': selectedImage,
							'description': input_description.val()
							}),
						dataType: 'json',
						url: serverLocation + '/select'
					});
				} else {
					warning_text = 'You have to select an image and describe it before proceeding!';
					$('#game').prepend('<div class="warning">' + warning_text + '</div>');
				}
			});

			$('#description-input input').keyup(function (event) {
				if (event.keyCode == 13) {
					$('#desc-btn').click();
				}
			}).focus();
		} else {
			text = 'Waiting for player ' + stateData.player_to_act + ' to select and desrcribe one of the images.';
			$('#match-image').append('<div class="wait-overlay"><span>' + text + '</span></div>');
		}
	}

	function setUpMatching (stateData) {
		var infoText = '',
			descriptionText = '',
			noticeText = '';

		$('#game .info').remove();
		$('#game .warning').remove();
		$('#game .notice').remove();
		$('#game .description').remove();

		if (player === stateData.describing_player) {
			$('#description-input').remove();
			$('#match-image').find('img').each(function(i, el) {
				$(el).unbind('click');

				if ($(el).attr('src') !== selectedImage) {
					$(el).addClass('grayed');
				}
			});

			descriptionText = 'Your description: ' + stateData.description;
			$('#game').prepend('<div class="description">' + descriptionText + '</div>');

			noticeText = 'You have selected an image. Wait for other players to match their images to your description.';
			$('#game').prepend('<div class="notice">' + noticeText + '</div>');
		} else {
			$('#match-image .wait-overlay').remove();

			descriptionText = stateData.describing_player + '\'s description: ' + stateData.description;
			$('#game').prepend('<div class="description">' + descriptionText + '</div>');

			infoText = 'Select an image that matches the description the most.';
			$('#game').prepend('<div class="info">' + infoText + '</div>');

			$('#game').append('<button class="btn" id="match-btn">Go!</button>');
			$('#game #match-btn').click(function (event) {
				var target = $(event.target),
					warning_text = '';
				if (selectedImage) {
					disableButton(target);
					$.ajax({
						type: "POST",
						url: serverLocation + '/match',
						data: JSON.stringify({'game_id': gameId,
							'player': player,
							'image': selectedImage
							}),
						dataType: 'json'
					});

					$('#match-image img').each(function (i, el) {
						if ($(el).attr('src') !== selectedImage) {
							$(el).unbind('click');
							$(el).addClass('grayed');
						}
					});
				} else {
					warning_text = 'You have to select an image before proceeding!';
					$('#game').prepend('<div class="warning">' + warning_text + '</div>');
				}
			});
		}
	}

	function displayImagesVoting(stateData) {
		var images = stateData.images;
		var images_wrapper = null;

		$('#game').prepend('<div id="vote-image" class="images"><div class="images-wrapper"></div></div>');

		images_wrapper = $('#game #vote-image .images-wrapper');

		$.each(images, function (i, el) {
			if (!(el === selectedImage && stateData.describing_player !== player)) {
				var img = $('<img src="' + el + '" />');
				var image_overlay = $('<div class="image-overlay"></div>');
				image_overlay.prepend(img);
				images_wrapper.append(image_overlay);

				img.click(function (event) {
					var target = $(event.target);

					if (target.is('img')) {
						images_wrapper.children().each(function (i, el) {
							$(el).removeClass('selected');
						});

						$(target).parent().addClass('selected');

						votedImage = target.attr('src');
					}
				});
			}
		});
	}

	function setUpVoting(stateData) {
		var descriptionText = '',
			infoText = '',
			noticeText = '';
		displayImagesVoting(stateData);

		$('#game .info').remove();
		$('#game .warning').remove();
		$('#game .notice').remove();
		$('#game .description').remove();

		if (player === stateData.describing_player) {
			descriptionText = 'Your description: ' + stateData.description;
			$('#game').prepend('<div class="description">' + descriptionText + '</div>');

			noticeText = 'You have to wait for other players to finish voting.';
			$('#game').prepend('<div class="notice">' + noticeText + '</div>');

			$('#game #vote-image .image-overlay img').addClass('grayed').unbind('click');
		} else {
			$('#game #match-btn').remove();
			descriptionText = stateData.describing_player + '\'s description: ' + stateData.description;
			$('#game').prepend('<div class="description">' + descriptionText + '</div>');

			infoText = 'Vote for the image you think the describing player has selected!';
			$('#game').prepend('<div class="info">' + infoText + '</div>');

			$('#game').append('<button class="btn" id="vote-btn">Vote!</button>');

			$('#game #vote-btn').click(function (event) {
				var target = $(event.target),
				warning_text = '';
				if (votedImage) {
					disableButton(target);
					$.ajax({
						type: "POST",
						url: serverLocation + '/vote',
						data: JSON.stringify({'game_id': gameId, 'player': player, 'image': votedImage}),
						dataType: 'json',
					});

					$('#game #vote-image img').each(function(i, el) {
						$(el).unbind('click');
						if ($(el).attr('src') !== votedImage) {
							$(el).addClass('grayed');
						}
					});
				} else {
					warning_text = 'You have to vote for an image before proceeding!';
					$('#game').prepend('<div class="warning">' + warning_text + '</div>');
				}
			});
		}
	}

	function setUpVoteDone(stateData) {
		var images_wrapper = null;

		$('#game').empty();

		$('#game').append('<div id="vote-image" class="images"><div class="images-wrapper"></div></div>');
		images_wrapper = $('#game #vote-image .images-wrapper');
		$.each(stateData.images, function (i, el) {
			var img = $('<img src="' + el + '" />'),
				image_overlay = $('<div class="image-overlay"></div>');

			if (el == stateData.correct_image) {
				image_overlay.addClass('selected');
				image_overlay.attr('style', 'background-color:' + playerColors[stateData.selection.selection.player] + ';');
			}

			image_overlay.append(img);

			$.each(stateData.votes, function (key, value) {
				if (value === el) {
					image_overlay.append('<div class="dot" style="background-color:' + playerColors[key] +';"></div>');
				}
			});
			images_wrapper.append(image_overlay);
		});

		$('.container').append('<button id="ready-btn" class="btn">Ready for a new round!</div>');
		$('.container').append('<div id="score"><ul></ul></div>');

		$('button#ready-btn').click(function (event) {
			var target = $(event.target);

			$.ajax({
				type: "POST",
				url: serverLocation + '/ready_next',
				data: JSON.stringify({'game_id': gameId, 'player': player}),
				dataType: 'json'
			});

			target.unbind('click');

			disableButton(target, target.html());
		});
	}

	function setUpGameOver(stateData) {
		var ul = null;

		$('.container').html('<div id="score"><ul><h1>Game Over</h1></ul></score>');

		ul = $('#score ul');
		$.each(getPlayersScoresList(stateData), function (i, el) {
			ul.append('<li><div class="dot" style="background-color:' + playerColors[el.player] + ';"></div>' + el.player + ' ' + el.totalScore + ' points (+' + el.roundScore + ')' + '</li>');
		});

		$('.container').prepend('<button id="start-new-btn" class="btn">Start a New Game</button>');
		$('#start-new-btn').click(function (event) {
			window.location.href = window.location.href.split('?')[0];
		});
	}

	function getPlayersScoresList(stateData) {
		var playersScores = {},
			playersScoresList = [];

		$.each(stateData.players, function (i, el) {
			playersScores[el] = {};
		});

		if (stateData.ready_for_next_round) {
			$.each(stateData.ready_for_next_round, function (i, el) {
				playersScores[el].ready = true;
			});
		}

		$.each(stateData.total_score, function (key, val) {
			playersScores[key].totalScore = val;
		});

		$.each(stateData.round_score, function (key, val) {
			playersScores[key].roundScore = val;
		});

		$.each(playersScores, function(key, val) {
			val.player = key;
			playersScoresList.push(val);
		});

		return playersScoresList.sort(function(a, b) { return b.totalScore - a.totalScore; });
	}

	function refreshScores(stateData) {
		var ul = $('.container #score ul');
		ul.empty();

		$.each(getPlayersScoresList(stateData), function(i, el) {
			ul.append('<li><div class="dot" style="background-color:' + playerColors[el.player] + ';"></div>' + (el.ready ? ('<span class="ready">' + el.player + '</span>') : el.player) + ' ' + el.totalScore + ' points (+' + el.roundScore + ')' + '</li>');
		});
	}

	function disableButton(buttonEl, value) {
		if (typeof(value) === 'undefined') {
			value = 'Waiting ...';
		}

		if (buttonEl.is('button')) {
			buttonEl.attr('disabled', 'disabled');
			buttonEl.html(value);
		}
	}

	function getQueryVariable(variable) {
		var query = window.location.search.substring(1);
		var vars = query.split('&');
		for (var i = 0; i < vars.length; i++) {
			var pair = vars[i].split('=');
			if (decodeURIComponent(pair[0]) == variable) {
				return decodeURIComponent(pair[1]);
			}
		}
		console.log('Query variable %s not found', variable);
	}
}
