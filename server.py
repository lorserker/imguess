import json
import game

from bottle import route, post, run, template, request

@route('/hello')
def index():
    return {'a':2, 'b':'mumataaaaa', 'c':[1,2,3,4]}


@post('/create/<host>')
def create(host):
	body = request.body.read()
	game_id = game.get_new_game_id()
	return {'status':'ok', 'game_id':game_id}


#@get('')

run(host='localhost', port=8080)