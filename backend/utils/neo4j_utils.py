import os
import logging
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError
from dotenv import load_dotenv

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载环境变量
load_dotenv()

class Neo4jConnection:
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI")
        self.user = os.getenv("NEO4J_USER")
        self.password = os.getenv("NEO4J_PASSWORD")
        self.driver = None
        
        if not all([self.uri, self.user, self.password]):
            raise ValueError("Neo4j连接信息不完整，请检查环境变量设置")
        
    def connect(self):
        if not self.driver:
            try:
                self.driver = GraphDatabase.driver(
                    self.uri,
                    auth=(self.user, self.password)
                )
                # 验证连接
                self.driver.verify_connectivity()
                logger.info("成功连接到Neo4j数据库")
            except (ServiceUnavailable, AuthError) as e:
                logger.error(f"连接Neo4j数据库失败: {str(e)}")
                raise
            
    def close(self):
        if self.driver:
            self.driver.close()
            logger.info("Neo4j数据库连接已关闭")
            
    def create_entity(self, tx, entity):
        query = (
            "MERGE (n:Entity {id: $id}) "
            "SET n.name = $name, "
            "n.type = $type, "
            "n.color = $color "
            "RETURN n"
        )
        result = tx.run(query, id=entity["id"], name=entity["name"],
                       type=entity["type"], color=entity["color"])
        return result.single()
               
    def create_relation(self, tx, relation):
        query = (
            "MATCH (source:Entity {id: $source_id}), "
            "(target:Entity {id: $target_id}) "
            "MERGE (source)-[r:RELATES {type: $type}]->(target) "
            "SET r.name = $name "
            "RETURN r"
        )
        result = tx.run(query, source_id=relation["source"], 
                       target_id=relation["target"],
                       type=relation["type"], name=relation["name"])
        return result.single()

def save_to_neo4j(entities, relations):
    """
    将知识图谱的实体和关系保存到Neo4j数据库
    
    Args:
        entities (list): 实体列表
        relations (list): 关系列表
    
    Returns:
        bool: 操作是否成功
    """
    conn = Neo4jConnection()
    try:
        conn.connect()
        with conn.driver.session() as session:
            # 创建实体
            for entity in entities:
                try:
                    session.execute_write(conn.create_entity, entity)
                    logger.info(f"成功创建实体: {entity['name']}")
                except Exception as e:
                    logger.error(f"创建实体失败 {entity['name']}: {str(e)}")
                    raise
                
            # 创建关系
            for relation in relations:
                try:
                    session.execute_write(conn.create_relation, relation)
                    logger.info(f"成功创建关系: {relation['name']}")
                except Exception as e:
                    logger.error(f"创建关系失败 {relation['name']}: {str(e)}")
                    raise
                    
        return True
                
    except Exception as e:
        logger.error(f"保存到Neo4j数据库时发生错误: {str(e)}")
        return False
        
    finally:
        conn.close() 