import os
import json

dir = '../../out/test/oracles/java'
out_dir = '../../out/test/oracles/out/java/new-ds'

out_file_names = os.listdir(out_dir)

out_commits = []
ans_commits = []

ans_dict = {}

num_sound = 0
num_complete = 0
num_sound_and_complete = 0
num_tot = 0

for file_name in out_file_names:
    # if not file_name.startswith('out_Z'):
    #     continue
    file_path = os.path.join(out_dir, file_name)
    now_out = []
    now_ans = []
    num_tot += 1
    with open(file_path, 'r') as file:
        content = file.read()
        try:
            out_data = json.loads(content)
            for commit in out_data:
                out_commits.append(commit)
                now_out.append(commit)
        except Exception as e:
            print(e)
    file_path = os.path.join(dir, file_name[4: ])
    with open(file_path, 'r') as file:
        content = file.read()
        try:
            out_data = json.loads(content)
            for commit in out_data['expectedResult'].keys():
                if out_data['expectedResult'][commit] != 'Ydocchange':
                    ans_commits.append(commit)
                    now_ans.append(commit)
                    ans_dict[commit] = out_data['expectedResult'][commit]
        except Exception as e:
            print(e)
    
    is_sound = True
    is_complete = True

    for commit in now_out:
        if commit not in now_ans:
            is_complete = False
    
    # print(file_name)
    for commit in now_ans:
        if commit not in now_out:
            is_sound = False
            # print(commit + ' ' + ans_dict[commit])

    if is_sound:
        num_sound += 1
    
    if is_complete:
        num_complete += 1
    
    if is_sound and is_complete:
        num_sound_and_complete += 1


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

print(f'num_tot = {num_tot}, num_sound = {num_sound}, num_complete = {num_complete}, num_sound_and_complete = {num_sound_and_complete}')