"""Generate BERTopic's hierarchical topic representation."""
def build_hierarchy(model, documents):
    frame = model.hierarchical_topics(documents)
    return frame[["Parent_ID", "Parent_Name", "Child_Left_ID", "Child_Right_ID", "Distance"]].to_dict(orient="records")
