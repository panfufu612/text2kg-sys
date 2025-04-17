from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
from neo4j import GraphDatabase
from utils.kg_gen import extract_entities_and_relations
import PyPDF2
from docx import Document
import json

app = Flask(__name__, 
            static_folder='../frontend/static',
            template_folder='../frontend/templates')
CORS(app)

# 配置上传文件夹
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Neo4j 配置
NEO4J_URI = "neo4j+s://b5aca062.databases.neo4j.io"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "f1JbNOL4JTcrBDmspbjYAe5QmZdHN6BdgLMWD9-2Ze0"

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_file(file_path, file_type):
    if file_type == 'txt':
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    elif file_type == 'pdf':
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ''
            for page in reader.pages:
                text += page.extract_text()
            return text
    elif file_type == 'docx':
        doc = Document(file_path)
        return '\n'.join([paragraph.text for paragraph in doc.paragraphs])
    return ''

def save_to_neo4j(entities, relations):
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    
    with driver.session() as session:
        # 创建实体节点
        for entity in entities:
            session.run(
                "MERGE (n:Entity {name: $name, type: $type})",
                name=entity["name"],
                type=entity["type"]
            )
        
        # 创建关系
        for relation in relations:
            session.run(
                "MATCH (a:Entity {name: $source}), (b:Entity {name: $target}) "
                "MERGE (a)-[:RELATION {relation: $relation}]->(b)",
                source=relation["source"],
                target=relation["target"],
                relation=relation["relation"]
            )
    
    driver.close()

@app.route('/')
def index():
    return render_template('text2kg.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件被上传'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # 提取文本
        file_type = filename.rsplit('.', 1)[1].lower()
        text = extract_text_from_file(file_path, file_type)
        
        # 提取实体和关系
        entities, relations = extract_entities_and_relations(text)
        
        # 保存到 Neo4j
        save_to_neo4j(entities, relations)
        
        # 返回结果
        return jsonify({
            'entities': entities,
            'relations': relations
        })
    
    return jsonify({'error': '不支持的文件类型'}), 400

@app.route('/process_text', methods=['POST'])
def process_text():
    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({'error': '没有提供文本内容'}), 400
        
        text = data['text']
        if not text.strip():
            return jsonify({'error': '文本内容为空'}), 400
        
        # 提取实体和关系
        entities, relations = extract_entities_and_relations(text)
        
        # 保存到 Neo4j
        save_to_neo4j(entities, relations)
        
        # 返回结果
        return jsonify({
            'entities': entities,
            'relations': relations
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save_to_neo4j', methods=['POST'])
def save_to_neo4j_endpoint():
    try:
        data = request.json
        if not data or 'entities' not in data or 'relations' not in data:
            return jsonify({'error': '数据格式不正确'}), 400

        # 保存到Neo4j
        save_to_neo4j(data['entities'], data['relations'])
        
        return jsonify({
            'message': '成功保存到Neo4j数据库',
            'status': 'success'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # 确保上传目录存在
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True) 