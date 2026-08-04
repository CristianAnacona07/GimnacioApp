import { TestBed } from '@angular/core/testing';
import { IndexedDBService } from './indexed-db.service';

/**
 * Tests para IndexedDBService
 *
 * NOTA: Estos tests requieren fake-indexeddb para funcionar en Node.js/Vitest
 * En un navegador real, IndexedDB funciona nativamente
 *
 * Para ejecutar estos tests, instala: npm install --save-dev fake-indexeddb
 * Y configura el setup en vitest.config.ts o test-setup.ts
 */
describe.skip('IndexedDBService (requiere IndexedDB mock)', () => {
  let service: IndexedDBService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndexedDBService);
  });

  it('debe ser creado', () => {
    expect(service).toBeTruthy();
  });

  // Tests comentados - descomentar cuando se configure fake-indexeddb
  /*
  describe('Timer State Management', () => {
    it('debe guardar y recuperar estado del cronómetro', async () => {
      const timerState = {
        endTime: Date.now() + 60000,
        total: 60,
        paused: undefined
      };

      await service.saveTimerState(timerState);
      const retrieved = await service.getTimerState();

      expect(retrieved).toBeTruthy();
      expect(retrieved?.endTime).toBe(timerState.endTime);
      expect(retrieved?.total).toBe(timerState.total);
    });
  });
  */
});
