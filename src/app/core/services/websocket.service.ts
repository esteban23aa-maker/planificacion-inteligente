import { Injectable } from '@angular/core';
import SockJS from 'sockjs-client';
import { Client, over } from 'stompjs';

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private stompClient: Client | null = null;

  connect() {
    const socket = new SockJS('http://localhost:8081/ws');
    this.stompClient = over(socket);
    this.stompClient.connect({}, () => {
      console.log('WebSocket conectado');
    });
  }

  subscribe(topic: string, callback: (message: any) => void) {
    this.stompClient?.subscribe(topic, (message: any) => {
      callback(JSON.parse(message.body));
    });
  }
}
