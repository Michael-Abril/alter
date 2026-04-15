Based on the project context, I'll build the core OpenClaw integration for Gmail that forms the foundation of the NightShift AI system. Here's the essential Gmail integration module:

```python
import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import json
import openai
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

@dataclass
class EmailTask:
    id: str
    sender: str
    subject: str
    body: str
    received_at: datetime
    priority: int
    category: str

class NightShiftGmailAgent:
    def __init__(self, credentials_path: str, openai_api_key: str):
        self.credentials = Credentials.from_authorized_user_file(credentials_path)
        self.gmail_service = build('gmail', 'v1', credentials=self.credentials)
        openai.api_key = openai_api_key
        
    def fetch_unread_emails(self, max_results: int = 50) -> List[EmailTask]:
        """Fetch unread emails and convert to EmailTask objects"""
        try:
            results = self.gmail_service.users().messages().list(
                userId='me', 
                q='is:unread',
                maxResults=max_results
            ).execute()
            
            messages = results.get('messages', [])
            email_tasks = []
            
            for msg in messages:
                email_data = self.gmail_service.users().messages().get(
                    userId='me', 
                    id=msg['id'],
                    format='full'
                ).execute()
                
                headers = {h['name']: h['value'] for h in email_data['payload']['headers']}
                body = self._extract_body(email_data['payload'])
                
                task = EmailTask(
                    id=msg['id'],
                    sender=headers.get('From', ''),
                    subject=headers.get('Subject', ''),
                    body=body,
                    received_at=datetime.fromtimestamp(int(email_data['internalDate'])/1000),
                    priority=self._calculate_priority(headers, body),
                    category=self._categorize_email(headers.get('Subject', ''), body)
                )
                email_tasks.append(task)
                
            return email_tasks
            
        except HttpError as error:
            print(f'Gmail API error: {error}')
            return []
    
    def _extract_body(self, payload: Dict) -> str:
        """Extract email body from Gmail API payload"""
        if 'parts' in payload:
            for part in payload['parts']:
                if part['mimeType'] == 'text/plain':
                    data = part['body']['data']
                    return self._decode_base64(data)
        elif payload['mimeType'] == 'text/plain':
            return self._decode_base64(payload['body']['data'])
        return ""
    
    def _decode_base64(self, data: str) -> str:
        import base64
        return base64.urlsafe_b64decode(data).decode('utf-8')
    
    def _calculate_priority(self, headers: Dict, body: str) -> int:
        """AI-powered priority scoring (1-10)"""
        prompt = f"""
        Analyze this email and assign priority (1-10):
        Subject: {headers.get('Subject', '')}
        From: {headers.get('From', '')}
        Body preview: {body[:200]}...
        
        Consider urgency keywords, sender importance, and content.
        Return only a number 1-10.
        """
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=10
            )
            return int(response.choices[0].message.content.strip())
        except:
            return 5  # Default priority
    
    def _categorize_email(self, subject: str, body: str) -> str:
        """Categorize email type"""
        categories = ["urgent", "meeting", "project_update", "client", "internal", "spam", "newsletter"]
        
        content = f"{subject} {body[:300]}".lower()
        
        if any(word in content for word in ["urgent", "asap", "emergency"]):
            return "urgent"
        elif any(word in content for word in ["meeting", "call", "zoom"]):
            return "meeting"
        elif any(word in content for word in ["project", "deadline", "deliverable"]):
            return "project_update"
        else:
            return "general"

# Usage example:
if __name__ == "__main__":
    agent = NightShiftGmailAgent(
        credentials_path="gmail_credentials.json",
        openai_api_key=os.getenv("OPENAI_API_KEY")
    )
    
    tasks = agent.fetch_unread_emails()
    high_priority = [t for t in tasks if t.priority >= 7]
    
    print(f"Found {len(high_priority)} high-priority emails to process")
```

This module provides the core Gmail integration with AI-powered email analysis, forming the foundation for task continuation. Next step: Build the task execution engine that acts on these EmailTask objects.