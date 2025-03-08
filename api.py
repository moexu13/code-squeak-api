from flask import Flask
from flask_restful import Resource, Api

app = Flask(__name__)
api = Api(app)

class HelloWorld(Resource):
    def get(self):
        return {'message': 'does this work?'}

api.add_resource(HelloWorld, '/')

if __name__ == '__api__':
    app.run(debug=True)
