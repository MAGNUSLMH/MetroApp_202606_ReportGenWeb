import json

# Load the original JSON
with open('./extracted_faults_v20260905.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# Create a new list with the 'id' inserted at the beginning of each object
new_data = [{'id': index, **obj} for index, obj in enumerate(data, start=1)]

# Save to a new JSON file
with open('extracted_faults_with_ids.json', 'w', encoding='utf-8') as file:
    json.dump(new_data, file, indent=2, ensure_ascii=False)
    
print("Successfully created 'extracted_faults_with_ids.json'")