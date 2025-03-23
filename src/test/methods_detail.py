import subprocess
import os
import json

dir = '../../out/test/oracles/java'
file_names = os.listdir(dir)

for file_name in file_names:
    file_path = os.path.join(dir, file_name)
    with open(file_path, 'r') as file:
        content = file.read()
        try:
            data = json.loads(content)
            command = [
                "java", 
                "-jar", 
                "codeshovel.jar", 
                "-repopath", '/Users/franky/Documents/Homework/毕业设计/testcase/' + data['repositoryName'],
                "-filepath", data['filePath'],
                "-methodname", data['functionName'],
                "-startline", str(data['functionStartLine']),
                "-startcommit", data['startCommitName'],
                "-outfile", './block_oracles/detail_methods/' + (file_name if not file_name.startswith('Z') else file_name[2:])
            ]
            subprocess.run(command, check=True)
        except Exception as e:
            print(e)