from ted.apted import APTED, Config
import sys, json

class CustomConfig(Config):
    def rename(self, node1, node2):
        """Compares attribute .value of trees"""
        return 1 if node1.value != node2.value else 0

    def children(self, node):
        """Get left and right children of binary tree"""
        return node.children

class AptedNode:
    def __init__(self, value: str, children=None):
        if children is None:
            children = []
        self.value = value
        self.children = children

    def add_child(self, child):
        """添加子节点"""
        self.children.append(child)

    def __repr__(self):
        """用于调试时的打印"""
        return f"AptedNode(label={self.value}, children={self.children})"

    @classmethod
    def from_dict(cls, data: dict):
        """从字典数据创建 AptedNode 对象"""
        value = data['value']
        children = [cls.from_dict(child) for child in data.get('children', [])]
        return cls(value, children)


# 获取命令行输入的 JSON 字符串
if len(sys.argv) != 3:
    print("Usage: python script.py '<json_string>' '<json_string>'")
    sys.exit(1)



# 解析 JSON 字符串
try:
    data = json.loads(sys.argv[1])

    tree1 = AptedNode.from_dict(data)
    data = json.loads(sys.argv[2])
    tree2 = AptedNode.from_dict(data)
    
except json.JSONDecodeError as e:
    print(f"Error parsing JSON: {e}")

# 计算树编辑距离
apted = APTED(tree1, tree2, CustomConfig())
ted = apted.compute_edit_distance()
mapping = apted.compute_edit_mapping()

print(f"Tree Edit Distance: {ted}")
print(f"Edit Mapping: {mapping}")