"""Incremental embedding clustering with River."""
from river import cluster


class OnlineTopicModel:
    def __init__(self, clusters=12, halflife=0.5):
        self.model = cluster.KMeans(n_clusters=clusters, halflife=halflife, seed=42)

    def learn(self, embedding):
        features = {index: float(value) for index, value in enumerate(embedding)}
        topic = self.model.predict_one(features)
        self.model.learn_one(features)
        return topic

    def predict(self, embedding):
        return self.model.predict_one({index: float(value) for index, value in enumerate(embedding)})
