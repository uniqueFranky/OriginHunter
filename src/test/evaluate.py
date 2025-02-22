import os
import json

dir = '../../out/test/oracles/java'
out_dir = '../../out/test/oracles/out/java/new-qw'

out_file_names = os.listdir(out_dir)

out_commits = []
ans_commits = []

for file_name in out_file_names:
    # if not file_name.startswith('out_Z'):
    #     continue
    file_path = os.path.join(out_dir, file_name)
    with open(file_path, 'r') as file:
        content = file.read()
        try:
            out_data = json.loads(content)
            for commit in out_data:
                out_commits.append(commit)
        except Exception as e:
            print(e)
    file_path = os.path.join(dir, file_name[4: ])
    with open(file_path, 'r') as file:
        content = file.read()
        try:
            out_data = json.loads(content)
            for commit in out_data['expectedResult'].keys():
                ans_commits.append(commit)
        except Exception as e:
            print(e)

print(len(out_commits))
print(len(ans_commits))



out_is_true = 0
true_in_out = 0

for commit in out_commits:
    if commit in ans_commits:
        out_is_true += 1

for commit in ans_commits:
    if commit in out_commits:
        true_in_out += 1

print(f'precision = {out_is_true / len(out_commits)}\nrecall = {true_in_out / len(ans_commits)}')