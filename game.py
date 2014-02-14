import uuid
import random
import urllib
import json

from collections import deque

def get_new_game_id():
	return str(uuid.uuid4())


class FakeImageService(object):

	def __init__(self):
		self.images = [
			'http://i.imgur.com/8OKwrmV.gif',
			'http://i.imgur.com/Yy8ejQq.jpg',
			'http://i.imgur.com/4ky56DZ.jpg',
			'http://i.imgur.com/PrP9ijS.jpg',
			'http://i.imgur.com/xf7sDOC.jpg',
			'http://i.imgur.com/eUIV76x.jpg',
			'http://i.imgur.com/rpDuXVi.jpg',
			'http://i.imgur.com/XJmu9nL.jpg',
		]

	def get(self):
		return random.choice(self.images)


class FlickrFeedImageService(object):
	
	def __init__(self, refill_threshold=10):
		self.feed_url = 'http://api.flickr.com/services/feeds/photos_public.gne?format=json'
		self.images = deque()
		self.load_images()
		self.refill_threshold = refill_threshold

	def load_images(self):
		response = urllib.urlopen(self.feed_url).read()
		for line in response.split('\n'):
			line = line.strip()
			if line.startswith('"media"'):
				obj = json.loads(line[line.index('{') : line.index('}') + 1])
				self.images.append(obj['m'].replace('_m.', '_q.'))

	def get(self):
		if len(self.images) < self.refill_threshold:
			self.load_images()
		return self.images.popleft()


class CatImageService(object):

	def __init__(self, refill_threshold=10):
		self.service_url = 'http://thecatapi.com/api/images/get?format=html&type=gif&size=small'
		self.images = deque()
		self.load_images()
		self.refill_threshold = refill_threshold

	def load_images(self):
		for _ in range(20):
			response = urllib.urlopen(self.service_url).read()
			img_url = response[response.index('src="') + 5 : response.rindex('"')]
			self.images.append(img_url)

	def get(self):
		if len(self.images) < self.refill_threshold:
			self.load_images()
		return self.images.popleft()



class GameRegistry(object):

	registry = None

	@classmethod
	def get(cls):
		if not cls.registry:
			cls.registry = cls()
		return cls.registry

	def __init__(self):
		self.games = {}

	def register(self, id, g):
		self.games[id] = g

	def remove(self, id):
		del self.games[id]

	def lookup_game(self, id):
		return self.games.get(id)


class Game(object):

	JOINING = 'joining'
	START_ROUND = 'start_round'
	MATCHING = 'matching'
	VOTING = 'voting'
	VOTING_DONE = 'vote_done'
	GAME_OVER = 'game_over'

	def __init__(self, id, hostplayer, img_service, max_score=32, n_img=6):
		self.id = id
		self.hostplayer = hostplayer
		self.players = [hostplayer]
		self.round_index = 0
		self.img_service = img_service
		self.state = Game.JOINING
		self.selection = None
		self.ready_for_next_round = set()
		self.max_score = max_score
		self.n_img = n_img
		self.player_images = {}
		self.images_selected = []

	def whose_turn(self):
		return self.players[self.round_index % len(self.players)]

	def close_joining(self, player):
		if self.state != Game.JOINING:
			return False, 'You cannot join in state: %s' % self.state
		if player != self.hostplayer:
			return False, 'Only %s can close joining phase' % self.hostplayer
		self.scorer = Scorer(self.players)
		self.state = Game.START_ROUND

	def close_game(self):
		GameRegistry.get().remove(self.id)

	def get_state(self, player):
		if player not in self.players:
			return {
				'state': 'error',
				'message': 'Who are you, intruder?',
			}
		if self.state == Game.JOINING:
			return {'state': self.state, 'players': self.players}
		if self.state == Game.START_ROUND:
			return {'state': self.state, 'player_to_act': self.whose_turn(), 'players': self.players}
		if self.state == Game.MATCHING:
			return {
				'state': self.state,
				'describing_player': self.selection['selection']['player'],
				'description': self.selection['selection']['description'],
				'already_answered': self.selection['answers'].keys(),
				'players': self.players
			}
		if self.state == Game.VOTING:			
			return {
				'state': self.state,
				'describing_player': self.selection['selection']['player'],
				'description': self.selection['selection']['description'],
				'already_voted': self.selection['votes'].keys(),
				'players': self.players,
				'images': self.images_selected
			}
		if self.state == Game.VOTING_DONE:			
			resp = {
				'state': self.state,				
				'selection': self.selection,
				'round_score': self.scorer.round_score,
				'total_score': self.scorer.scores,
				'players': self.players,
				'ready_for_next_round': list(self.ready_for_next_round),
				'images': self.images_selected,
				'correct_image': self.selection['selection']['image'],
				'votes': self.selection['votes']
			}
			if len(self.player_images[player]) < self.n_img:
				new_image = self.img_service.get()
				self.player_images[player].add(new_image)
				resp['new_image'] = new_image
			return resp
		if self.state == Game.GAME_OVER:
			return {
				'state': self.state,
				'selection': self.selection,
				'round_score': self.scorer.round_score,
				'total_score': self.scorer.scores,
				'players': self.players,
			}

	def get_images(self, player):
		images = []
		for _ in range(self.n_img):
			images.append(self.img_service.get())		
		self.player_images[player] = set(images)
		return images


	def join(self, player):
		if self.state != Game.JOINING:
			return False, 'Cannot join in state: %s' % Game.JOINING
		if player in self.players:
			return False, 'Player already joined'
		self.players.append(player)
		return True, 'Success'

	def select(self, player, image, description):
		if self.state != Game.START_ROUND:
			return False, 'Cannot make selection in state: %s' % self.state
		if player != self.whose_turn():
			return False, 'It is not %s\'s turn' % player
		self.player_images[player].remove(image)
		self.selection = {
			'selection': {
				'player': player,
				'image': image,
				'description': description
			},
			'answers': {},
			'votes': {},
		}
		self.state = Game.MATCHING
		return True, 'Success'

	def match(self, player, image):
		if self.state != Game.MATCHING:
			return False, 'Cannot make a match in state: %s' % self.state
		self.selection['answers'][player] = image
		self.player_images[player].remove(image)
		if len(self.selection['answers']) == len(self.players) - 1:
			# all players have answered
			self.images_selected = [self.selection['selection']['image']] + self.selection['answers'].keys()
			random.shuffle(self.images_selected)
			self.state = Game.VOTING
		return True, 'Success'

	def vote(self, player, image):
		if self.state != Game.VOTING:
			return False, 'Cannot vote in state: %s' % self.state
		self.selection['votes'][player] = image
		if len(self.selection['votes']) == len(self.players) - 1:
			# all players have voited already
			self.state = Game.VOTING_DONE
			# compute scores
			round_score = self.scorer.get_round_score(self.selection)
			self.scorer.update_score(round_score)
			if max(self.scorer.scores.values()) >= self.max_score:
				self.state = Game.GAME_OVER
			return True, 'Success'
	
		# some players still have to vote
		return True, 'Success'

	def ready_next(self, player):
		if self.state != Game.VOTING_DONE:
			return False, 'Cannot be ready for next round in state: %s' % self.state
		self.ready_for_next_round.add(player)
		if len(self.ready_for_next_round) == len(self.players):
			# allplayers are ready
			self.state = Game.START_ROUND
			self.round_index += 1
		return True, 'Success'

	
class Scorer(object):

	def __init__(self, players):
		self.players = players
		self.scores = {p:0 for p in self.players}

	def update_score(self, round_score):
		for player, score in round_score.iteritems():
			self.scores[player] += score

	def get_round_score(self, selection):
		assert len(selection['votes']) == len(self.players) - 1
		round_score = {p:0 for p in self.players}
		descr_player = selection['selection']['player']
		correct_image = selection['selection']['image']
		correct_voters = set()
		img_to_player = {img:player for player, img in selection['answers'].items()}
		# assign scores
		for player, image in selection['votes'].items():
			if image == correct_image:
				correct_voters.add(player)
			else:
				player_voted = img_to_player[image]
				round_score[player_voted] += 1
		if len(correct_voters) == 0 or len(correct_voters) == len(self.players) - 1:
			# nobody guessed or everybody guessed, everybody gets 2 points, except the describing player
			for player in self.players:
				if player != descr_player:
					round_score[player] += 2
		else:
			# at least one, but not all players guessed
			# describing player gets three points
			round_score[descr_player] += 3
		self.round_score = round_score
		return round_score












