import unittest
import game

class GameTest(unittest.TestCase):

	def setUp(self):
		self.game_id = game.get_new_game_id()
		self.g = game.Game(self.game_id, 'alice', game.FakeImageService(), 10, 6)	

	def testGameRegistry(self):
		self.assertIsNotNone(game.GameRegistry.get().lookup_game(self.game_id))
		self.assertIsNone(game.GameRegistry.get().lookup_game(self.game_id + 'fgdfgdfgdfgdsg'))

	def testGameJoining(self):		
		self.g.join('bob')
		state = self.g.get_state('alice')
		self.assertEqual(state, {
			'state': game.Game.JOINING,
			'players': ['alice', 'bob']
		})

	def testOneRound(self):
		g = game.Game(game.get_new_game_id(), 'alice', game.TestImageService(), 10, 6)
		g.join('bob')
		g.join('chris')
		g.get_images('alice')
		g.get_images('bob')
		g.get_images('chris')
		self.assertEqual(len(g.player_images['alice']), g.n_img)
		self.assertEqual(len(g.player_images['bob']), g.n_img)
		self.assertEqual(len(g.player_images['chris']), g.n_img)
		self.assertEqual(g.get_state('alice'), {
			'state': game.Game.JOINING,
			'players': ['alice', 'bob', 'chris']
		})
		g.close_joining('alice')
		self.assertEqual(g.get_state('alice'), {
			'state': game.Game.START_ROUND,
			'players': ['alice', 'bob', 'chris'],
			'player_to_act': 'alice'
		})
		g.select('alice', 'img_0', 'description alice')
		self.assertEqual(g.get_state('alice'), {
			'state': game.Game.MATCHING,
			'players': ['alice', 'bob', 'chris'],
			'describing_player': 'alice',
			'description': 'description alice',
			'already_answered': [],
		})
		g.match('bob', 'img_6')
		self.assertEqual(g.get_state('alice'), {
			'state': game.Game.MATCHING,
			'players': ['alice', 'bob', 'chris'],
			'describing_player': 'alice',
			'description': 'description alice',
			'already_answered': ['bob'],
		})
		self.assertEqual(len(g.player_images['alice']), g.n_img - 1)
		self.assertEqual(len(g.player_images['bob']), g.n_img - 1)
		self.assertEqual(len(g.player_images['chris']), g.n_img)
		g.match('chris', 'img_12')
		self.assertEqual(len(g.player_images['chris']), g.n_img - 1)
		self.assertEqual(g.get_state('alice'), {
			'state': game.Game.VOTING,
			'players': ['alice', 'bob', 'chris'],
			'describing_player': 'alice',
			'description': 'description alice',
			'already_voted': [],
			'images': g.images_selected
		})
		self.assertEqual(len(g.images_selected), len(g.players))
		g.vote('bob', 'img_0')
		g.vote('chris', 'img_6')
		#print g.get_state('alice')
		self.assertEqual(g.get_state('alice'), {
			'state': game.Game.VOTING_DONE,
			'players': ['alice', 'bob', 'chris'],						
			'images': g.images_selected,
			'selection': {
				'selection': {
					'player': 'alice',
					'image': 'img_0',
					'description': 'description alice',
				},
				'answers': {
					'bob': 'img_6',
					'chris': 'img_12',
				},
				'votes': {
					'bob': 'img_0',
					'chris': 'img_6',
				}
			},
			'correct_image': 'img_0',
			'ready_for_next_round': [],
			'votes': {
				'bob': 'img_0',
				'chris': 'img_6',
			},
			'round_score': {
				'alice': 3,
				'bob': 2,
				'chris': 0,
			},
			'total_score': {
				'alice': 3,
				'bob': 2,
				'chris': 0,
			},
		})



def main():
	unittest.main()


if __name__ == '__main__':
	main()


