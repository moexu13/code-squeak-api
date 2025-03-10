# flask --app api.py --debug run
from dotenv import load_dotenv
import os
load_dotenv()

from langchain_core.messages import HumanMessage, SystemMessage
from langchain.chat_models import init_chat_model

model = init_chat_model(os.getenv('ANTHROPIC_MODEL'), model_provider='anthropic')
prompt = SystemMessage("You are a senior software engineer. Give feedback on this code to help a junior engineer.")

from flask import Flask, request
from flask_restful import Resource, Api

app = Flask(__name__)
api = Api(app)

class CodeAnalysis(Resource):
    def get(self):
        return { 'message': 'Code analysis API v1' }
    
    def post(self):
        data = request.get_json()
        code = data['data']['code']
        output = model.invoke([prompt, HumanMessage(code)])
        return { 'code': output.content }, 201

api.add_resource(CodeAnalysis, '/v1/code')

if __name__ == '__main__':
    app.run(debug=True)
