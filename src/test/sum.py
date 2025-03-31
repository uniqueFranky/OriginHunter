import os
import json
import requests
import gensim.downloader as api
import re

import torch
from transformers import BertTokenizer, BertModel
from sklearn.cluster import KMeans
import numpy as np
from collections import Counter
from sklearn.metrics.pairwise import cosine_similarity

from rank_bm25 import BM25Okapi
from nltk.tokenize import word_tokenize
import string


def test_validaty(data, sums, idx):
    sum = sums[idx]
    url = "https://api.siliconflow.cn/v1/chat/completions"
    prompt = f"""
Given the following text, which is a summary of discussions from GitHub Issues and PRs, please extract and return the most important keywords or phrases. Focus on key concepts, reasons, and impacts related to code changes. Exclude common stop words (e.g., 'the', 'and', 'is'). List the keywords or phrases in order of relevance, from most to least important.

Return the result as a JSON array of strings, where each string represents a keyword or phrase.

<Text>
{sum}
</Text>

Example of the desired output format:
["keyword1", "keyword2", "keyword3", ...]

Ensure the output is valid JSON without any additional explanation or content.
"""
    payload = {
        "model": "Pro/deepseek-ai/DeepSeek-V3",
        "stream": False,
        "max_tokens": 512,
        "temperature": 0.7,
        "top_p": 0.7,
        "top_k": 50,
        "frequency_penalty": 0.5,
        "n": 1,
        "messages": [
            {
                "content": prompt,
                "role": "user"
            }
        ]
    }
    headers = {
        "Authorization": "Bearer sk-jxguoulawpisdcyogptsancfrxfiavwkvnkabnsfmdresttm",
        "Content-Type": "application/json"
    }

    response = requests.request("POST", url, json=payload, headers=headers)

    resp = json.loads(response.text)

    kw = json.loads(resp['choices'][0]['message']['content'])
    kws = [word for phrase in kw for word in phrase.split()]
    

    corpus = ''.join(dialog for post in data['posts'] for comment in post['comments'] for dialog in comment['body'])
    
    found = []
    unfound = []
    for k in kws:
        if corpus.find(k):
            found.append(k)
        else:
            unfound.append(k)
    return 1.0 * len(found) / (len(found) + len(unfound))


def test_variance(data, sums, idx):

    # 计算簇内平均相似度
    def calculate_within_cluster_similarity(embeddings, kmeans_labels):
        num_clusters = len(set(kmeans_labels))  # 聚类簇的数量
        cluster_similarities = []  # 存储每个簇的相似度

        for cluster in range(num_clusters):
            cluster_indices = np.where(kmeans_labels == cluster)[0]
            similarities = []

            # 计算每个簇内句子的余弦相似度
            for i in range(len(cluster_indices)):
                for j in range(i + 1, len(cluster_indices)):
                    idx1, idx2 = cluster_indices[i], cluster_indices[j]
                    cos_sim = cosine_similarity([embeddings[idx1]], [embeddings[idx2]])[0][0]
                    similarities.append(cos_sim)

            # 计算簇内句子的平均相似度
            avg_similarity = np.mean(similarities) if similarities else 0
            cluster_similarities.append(avg_similarity)

        return np.mean(cluster_similarities)

    # 计算簇间平均相似度
    def calculate_between_cluster_similarity(cluster_centers):
        num_clusters = len(cluster_centers)
        similarities = []

        # 计算每对簇中心之间的余弦相似度
        for i in range(num_clusters):
            for j in range(i + 1, num_clusters):
                cos_sim = cosine_similarity([cluster_centers[i]], [cluster_centers[j]])[0][0]
                similarities.append(cos_sim)

        return np.mean(similarities)

    # 计算簇内相似度和簇间相似度的比较
    def compare_within_and_between_similarity(embeddings, kmeans_labels, cluster_centers):
        # 计算簇内平均相似度
        within_similarity = calculate_within_cluster_similarity(embeddings, kmeans_labels)
        # print(f"Average within-cluster similarity: {within_similarity:.4f}")

        # 计算簇间平均相似度
        between_similarity = calculate_between_cluster_similarity(cluster_centers)
        # print(f"Average between-cluster similarity: {between_similarity:.4f}")

        return within_similarity, between_similarity
            


    # 获取输入文本
    sum_text = sums[idx]
    
    # 分句
    sentences = re.split(r'(?<=[.!?])\s+|\n', sum_text)
    sentences = [s for s in sentences if s.strip() != '']

    # 初始化 BERT 模型和分词器
    model_name = 'bert-base-uncased'
    tokenizer = BertTokenizer.from_pretrained(model_name)
    model = BertModel.from_pretrained(model_name)

    # 定义获取句子BERT嵌入的函数
    def get_bert_embeddings(sentence):
        inputs = tokenizer(sentence, return_tensors="pt", truncation=True, padding=True)
        with torch.no_grad():
            outputs = model(**inputs)
        return outputs.last_hidden_state[0][0]  # 取 [CLS] token 的嵌入
    
    # 获取所有句子的 BERT 嵌入
    sentence_embeddings = [get_bert_embeddings(sentence) for sentence in sentences]
    embeddings = np.array([embedding.numpy() for embedding in sentence_embeddings])

    # 使用 KMeans 聚类，将句子分成 5 类
    num_clusters = 5
    kmeans = KMeans(n_clusters=num_clusters, random_state=0)
    kmeans.fit(embeddings)

    # 输出每个簇包含的句子数量
    cluster_counts = Counter(kmeans.labels_)
    # print("Number of sentences in each cluster:")
    # for cluster, count in cluster_counts.items():
    #     print(f"Cluster {cluster}: {count} sentences")

    
    cluster_centers = kmeans.cluster_centers_
    return compare_within_and_between_similarity(embeddings, kmeans.labels_, cluster_centers)


def test_depth(data, sums, idx):
    text = json.dumps(data['posts'])
    sum = sums[idx]
    prompt = f"""
You are given a summary of the reason for a target code change, which is a part of code change of a full commit, extracted from discussions in GitHub Issues and Pull Requests (PRs) related to a specific commit. Your task is to evaluate and assign a depth level to this summary based on the following criteria:

1. **Level 1: Basic Summary**  
   - The summary is vague or overly general, with minimal to no detail about specific code changes.
   - It may mention the commit as a whole without addressing any specific code changes.
   - The reason for the change and its impact are not explained.

2. **Level 2: Basic Code Change Explanation**  
   - The summary mentions the code change but lacks detail about the specific line or section of code modified.
   - It provides a brief explanation for the change (e.g., fixing a bug or adding a feature) but lacks deeper context.
   - The impact of the change is not discussed in detail.
   - There is no clear connection between the specific code change and the overall commit.

3. **Level 3: Code Change and Reasoning**  
   - The summary clearly identifies specific code changes (e.g., which function, method, or variable was modified) but does not provide an in-depth explanation of why the change was necessary.
   - The reason for the change may be discussed (e.g., fixing a bug or improving performance), but without explaining why this approach was chosen.
   - The impact of the change may be touched on, but not comprehensively.
   - The relationship between the specific code changes and the overall commit is mentioned in a general way (e.g., "This change is part of a larger fix").

4. **Level 4: Specific Code Changes with Justification and Impact**  
   - The summary identifies specific code changes (e.g., line numbers or methods) and provides a clear explanation of why those changes were made.
   - It discusses the impact of the change, explaining how it improves performance, fixes a bug, or adds a feature.
   - The summary may briefly touch on the broader context (e.g., related issues or pull requests), but remains focused on the particular change.
   - There is a clear explanation of how the specific code changes fit into the overall commit.

5. **Level 5: Detailed Explanation of Specific Code Changes, Reasons, Full Impact, and Relationship to the Entire Commit**  
   - The summary is highly specific, identifying exact code changes, and explains in detail why those changes were necessary (e.g., issues solved, enhancements introduced).
   - The reasoning behind choosing a particular method or approach over alternatives should be included.
   - The impact of the change should be fully explained, including both immediate effects and potential long-term implications on the codebase.
   - The summary explains in detail how the specific code changes fit into the broader context of the entire commit, including how they contribute to the larger goal (e.g., refactoring, bug fix, or feature addition).
   - The summary may mention how the change relates to other parts of the codebase, project goals, or previously discussed issues/PRs.
   - No additional or unsupported information is included.
   
**Instructions:**  
Review the provided summary and assign it to the appropriate level (1-5) based on the criteria above. Focus on the specificity of the code change, the reasoning behind it, its impact, and how the change relates to the overall commit.

Please provide your evaluation in the following format:
{{
  "depth_level": <1-5>,
  "explanation": "<Short explanation of why the summary was rated at this level. Detailed reasons for choosing over alternatives (if any)>"
}}

<Target Code>
{data['current']['code']}
</Target Code>


<Summary>
{sum}
</Summary>

Example output:
{{
  "depth_level": 4,
  "explanation": "The summary provides specific code changes and explains their reason and impact. It also mentions how the changes relate to the overall commit."
}}
"""

    url = "https://api.siliconflow.cn/v1/chat/completions"
    payload = {
        "model": "Pro/deepseek-ai/DeepSeek-V3",
        "stream": False,
        "max_tokens": 512,
        "temperature": 0.7,
        "top_p": 0.7,
        "top_k": 50,
        "frequency_penalty": 0.5,
        "n": 1,
        "messages": [
            {
                "content": prompt,
                "role": "user"
            }
        ]
    }
    headers = {
        "Authorization": "Bearer sk-jxguoulawpisdcyogptsancfrxfiavwkvnkabnsfmdresttm",
        "Content-Type": "application/json"
    }

    response = requests.request("POST", url, json=payload, headers=headers)
    resp = json.loads(response.text)
    content = resp['choices'][0]['message']['content']
    def extract_json_strings(text):
        # 正则表达式匹配大括号包裹的 JSON 字符串
        pattern = r'\{.*\}'
        # 使用 re.findall 提取所有匹配的 JSON 字符串
        return re.findall(pattern, text, re.DOTALL)[0]
    obj = json.loads(extract_json_strings(content))
    return obj['depth_level']

def sum_bm25(data):
    # Tokenizing the corpus: Removing punctuation and splitting into words
    def preprocess(text):
        # Remove punctuation and tokenize
        text = text.translate(str.maketrans("", "", string.punctuation))
        return word_tokenize(text.lower())
    corpus = [comment['body'] for post in data['posts'] for comment in post['comments']]
    tokenized_corpus = [preprocess(doc) for doc in corpus]
    bm25 = BM25Okapi(tokenized_corpus)

    def query_about(query):
        tokenized_query = preprocess(query)

        scores = bm25.get_scores(tokenized_query)

        # Rank documents by score (higher score = more relevant)
        ranked_docs = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)

        ret = ''
        for rank, doc_index in enumerate(ranked_docs, start=1):
            if rank >= 3:
                break
            ret += corpus[doc_index]
        return ret
    
    reason = query_about('reason')
    feedback = query_about('feedback')
    decision = query_about('decision')
    challenge = query_about('challenge')
    conclusion = query_about('conclusion')
    
    sum = f"""
#### 1. **Reason for the change:**
{reason}

#### 2. **Developer suggestions or feedback:**
{feedback}

#### 3. **Technical decisions:**
{decision}

#### 4. **Challenges or issues addressed by the function change:**
{challenge}

#### 5. **Outcome and conclusions:**
{conclusion}
"""
    return sum

if __name__ == '__main__':
    dir = '../../out/test/sum'

    file_names = os.listdir(dir)

    hit_rates = [[], []]
    within_sims = [[], []]
    between_sims = [[], []]
    depths = [[], []]
    tot_len = []
    sum_len = [[], []]

    for file_name in file_names:
        file_path = os.path.join(dir, file_name)
        with open(file_path, 'r') as file:
            content = file.read()
            try:
                data = json.loads(content)
                sums = [data['agentSum']['text'], sum_bm25(data)]
                for i in [0, 1]:
                #     hit_rates[i].append(test_validaty(data, sums, i))
                #     w, b = test_variance(data, sums, i)
                #     within_sims[i].append(w)
                #     between_sims[i].append(b)
                #     depths[i].append(test_depth(data, sums, i))
                    sum_len[i].append(len(sums[i].split()))
                    corpus = ' '.join(comment['body'] for post in data['posts'] for comment in post['comments'])
                    tot_len.append(len(corpus.split()))

            except Exception as e:
                print(e)

    
    print(sum(tot_len) / len(tot_len))
    print(sum(sum_len[0]) / len(sum_len[0]))
    print(sum(sum_len[1]) / len(sum_len[1]))
    # for i in [0, 1]:
    #     # 平均命中率
    #     avg_hit_rate = sum(hit_rates[i]) / len(hit_rates[i]) if hit_rates[i] else 0
    #     # 簇内相似度大于簇间相似度的比率
    #     within_larger_than_between_rate = sum(1 for w, b in zip(within_sims[i], between_sims[i]) if w > b) / len(within_sims[i]) if within_sims[i] else 0
    #     # 平均深度
    #     avg_depth = sum(depths[i]) / len(depths[i]) if depths[i] else 0
        
    #     # 输出结果
    #     print(f"Sum {i} - Avg Hit Rate: {avg_hit_rate:.4f}")
    #     print(f"Sum {i} - Within > Between Rate: {within_larger_than_between_rate:.4f}")
    #     print(f"Sum {i} - Avg Depth: {avg_depth:.4f}")