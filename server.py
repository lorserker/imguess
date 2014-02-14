import json
import game

from bottle import route, post, get, run, request, static_file

@route('/hello')
def index():
    return {'a':2, 'b':'mumataaaaa', 'c':[1,2,3,4]}


@get('/create/<host>')
def create(host):	
	game_id = game.get_new_game_id()
	g = game.Game(game_id, host, game.FlickrFeedImageService(), 32, 6)	
	print game.GameRegistry.get().games.keys()
	return {'status':'ok', 'game_id':game_id}

@post('/join')
def join():
	body = request.body.read()
	print body
	obj = json.loads(body)
	g = game.GameRegistry.get().lookup_game(obj['game_id'])
	success, message = g.join(obj['player'])
	return {
		'status': 'ok' if success else 'error',
		'message': message
	}

@post('/terminate')
def terminate():
	body = request.body.read()
	print body
	obj = json.loads(body)
	g = game.GameRegistry.get().lookup_game(obj['game_id'])
	g.close_game()
	return {'status': 'ok'}

@post('/state')
def get_state():
	body = request.body.read()
	print body
	obj = json.loads(body)
	g = game.GameRegistry.get().lookup_game(obj['game_id'])
	state_obj = g.get_state(obj['player'])
	print state_obj
	return state_obj

@post('/end_joining')
def end_joining():
	body = request.body.read()
	print body
	obj = json.loads(body)
	g = game.GameRegistry.get().lookup_game(obj['game_id'])
	g.close_joining(obj['player'])
	return {
		'status': 'ok',
		'message': 'geme ready to start'
	}

@post('/get_images')
def get_images():
	body = request.body.read()
	print body
	obj = json.loads(body)
	g = game.GameRegistry.get().lookup_game(obj['game_id'])
	images = g.get_images(obj['player'])
	return {
		'status': 'ok' if images else 'error',
		'response': images
	}

@post('/select')
def select():
	body = request.body.read()
	print body
	obj = json.loads(body)
	g = game.GameRegistry.get().lookup_game(obj['game_id'])
	success, message = g.select(obj['player'], obj['image'], obj['description'])
	return {
		'status': 'ok' if success else 'error',
		'message': message
	}

@post('/match')
def match():
	body = request.body.read()
	print body
	obj = json.loads(body)
	g = game.GameRegistry.get().lookup_game(obj['game_id'])
	success, message = g.match(obj['player'], obj['image'])
	return {
		'status': 'ok' if success else 'error',
		'message': message
	}

@post('/vote')
def vote():
	body = request.body.read()
	print body
	obj = json.loads(body)
	g = game.GameRegistry.get().lookup_game(obj['game_id'])
	success, message = g.vote(obj['player'], obj['image'])
	return {
		'status': 'ok' if success else 'error',
		'message': message
	}

@post('/ready_next')
def ready_next():
	body = request.body.read()
	print body
	obj = json.loads(body)
	g = game.GameRegistry.get().lookup_game(obj['game_id'])
	success, message = g.ready_next(obj['player'])
	return {
		'status': 'ok' if success else 'error',
		'message': message
	}

@get('/list_games')
def list_games():
	return {'status': 'ok', 'games': game.GameRegistry.get().games.keys()}

@route('/static/<filename>')
def server_static(filename):
	return static_file(filename, root='./static')

@get('/test_images')
def test_images():
	# imgsrv = game.CatImageService()
	imgsrv = game.FlickrFeedImageService()
	results = []
	for _ in range(20):
		results.append(imgsrv.get())
	return {'status': 'ok', 'response':results}

run(host='localhost', port=8080)