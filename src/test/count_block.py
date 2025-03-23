import os
import sys
import json

out_dir = '../../out/test/block_oracles/out'

test_dir = '../../out/test/block_oracles/test'
train_dir = '../../out/test/block_oracles/training'

tot_out = 0
tot_ans = 0
tot_ans_is_in = 0
tot_out_is_true = 0

out_file_names = os.listdir(out_dir)
for out_name in out_file_names:
    out_path = os.path.join(out_dir, out_name)
    with open(out_path, 'r') as file:
        out_content = file.read()
        try:
            out_data = json.loads(out_content)
            ans_path = os.path.join(test_dir, out_name)
            if not os.path.exists(ans_path):
                ans_path = os.path.join(train_dir, out_name)
            with open(ans_path, 'r') as ans_file:
                ans_content = ans_file.read()
                ans_data = json.loads(ans_content)

            out_len = len(out_data)
            

            ans_commits = []
            for change in ans_data['expectedChanges']:
                if change['commitId'] not in ans_commits:
                    ans_commits.append(change['commitId'])
                    
            ans_len = len(ans_commits)
            out_is_true = 0
            ans_is_in = 0

            for commit in out_data:
                if commit in ans_commits:
                    out_is_true += 1
            for commit in ans_commits:
                if commit in out_data:
                    ans_is_in += 1
            if out_len > 1 and out_data[-2] == ans_commits[-1]:
                out_len -= 1

            tot_out += out_len
            tot_ans += ans_len
            tot_out_is_true += out_is_true
            tot_ans_is_in += ans_is_in
            if out_is_true < out_len or ans_is_in < ans_len:
                print(out_name)
                print(f'out = {out_len}, ans = {ans_len}, out_is_true = {out_is_true}, ans_is_in = {ans_is_in}')

        except Exception as e:
            print(e)

print(f'out_len = {tot_out}, ans_len = {tot_ans} out_is_true = {tot_out_is_true}, ans_is_in = {tot_ans_is_in}')
print(f'precision = {tot_out_is_true / tot_out}, recall = {tot_ans_is_in / tot_ans}')