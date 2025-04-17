import re
import warnings
warnings.filterwarnings("ignore")
import os
from kg_gen import KGGen
# from openai import OpenAI
# import openai
from .neo4j_utils import save_to_neo4j
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 代理设置（从环境变量获取）
if os.getenv('HTTP_PROXY'):
    os.environ['HTTP_PROXY'] = os.getenv('HTTP_PROXY')
if os.getenv('HTTPS_PROXY'):
    os.environ['HTTPS_PROXY'] = os.getenv('HTTPS_PROXY')

# 设置OpenAI API密钥
# openai.api_key = os.getenv('OPENAI_API_KEY')

# 初始化KGGen
kg = KGGen(
    model=os.getenv('OPENAI_MODEL', 'gpt-4o'),
    temperature=float(os.getenv('OPENAI_TEMPERATURE', '0.3')),
    api_key=os.getenv('OPENAI_API_KEY')
)


# def get_entity_type(entity):
#     """
#     Function to analyze and classify an entity's type using OpenAI's GPT model.
#     """
#     try:
#         # Create the message to be sent to the OpenAI API
#         messages = [
#             {"role": "system", "content": "You are an expert in analyzing the type of entities. Based on the given entity, classify it into categories like Person, Location, Time, Organization, Event, or Other."},
#             {"role": "user", "content": f"Please classify the following entity: {entity}"},
#             {"role": "assistant", "content": """
#                 Example 1: 
#                 Input: Please classify the following entity: 坂本龍馬 
#                 Output: Person
#                 Example 2: 
#                 Input: Please classify the following entity: 日本
#                 Output: Location
#                 Example 3: 
#                 Input: Please classify the following entity: 1800-01-01
#                 Output: Time
#                 Example 4: 
#                 Input: Please classify the following entity: 美国商务部
#                 Output: Organization
#                 Example 5: 
#                 Input: Please classify the following entity: 杀人事件
#                 Output: Event
#                 Example 6: 
#                 Input: Please classify the following entity: 子产品供应链
#                 Output: Other
#                 Example 7: 
#                 Input: Please classify the following entity: 西游记
#                 Output: Work
#             """}
#         ]

#         # Call OpenAI API for classification
#         response = openai.chat.completions.create(
#             model="gpt-4o",  # GPT model of your choice
#             messages=messages,
#             max_tokens=100,
#             temperature=0.3,
#             n=1,
#             stop=None
#         )
        
#         # Extract the entity type from the response
#         return response['choices'][0]['message']['content'].strip()
#     except Exception as e:
#         print(f"Error with OpenAI API: {e}")
#         return "Unknown"  # Default return value in case of error


def extract_entities_and_relations(text):
    """
    从文本中提取实体和关系，接口适配函数
    """
    if not text or len(text.strip()) == 0:
        return [], []
    
    # 使用KGGen生成知识图谱
    graph = kg.generate(input_data=text, context="新闻", cluster=True)
    
    # 转换为需要的格式
    entities = []
    for entity in graph.entities:
        print(f"Entity: {entity}")
        
        # 使用 OpenAI 判断实体类型
        # entity_type = get_entity_type(entity)
        entity_type = "Unknown"  # 暂时使用 Unknown 作为默认值
        entities.append({
            "name": entity,
            "type": entity_type
        })
    
    # 处理关系
    relations = []
    for source, relation, target in graph.relations:
        print(f"Source: {source}, Relation: {relation}, Target: {target}")
        # 处理目标可能是列表的情况
        if isinstance(target, list):
            for t in target:
                relations.append({
                    "source": source,
                    "target": t,
                    "relation": relation
                })
        else:
            relations.append({
                "source": source,
                "target": target,
                "relation": relation
            })
    
    return entities, relations 


