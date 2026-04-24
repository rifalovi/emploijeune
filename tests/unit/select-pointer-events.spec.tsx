import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';

/**
 * Tests de non-régression pour le hotfix 4f :
 *
 *   1. BUG 1 : le clic sur un item du dropdown ne sélectionnait rien.
 *      Cause racine : le `Positioner` Base-UI applique `pointer-events: none`
 *      sur son conteneur (comportement inert), qui héritait jusqu'aux items.
 *      Fix : classe `pointer-events-auto` sur le Popup.
 *
 *   2. BUG 2 : les libellés longs étaient tronqués dans la liste déroulante.
 *      Cause racine : `alignItemWithTrigger={true}` (mode Radix) contraignait
 *      la largeur du popup à celle du trigger.
 *      Fix : `alignItemWithTrigger={false}` + `min-w-(--anchor-width)` pour
 *      garantir au minimum la largeur du trigger, mais autoriser l'expansion.
 *
 * Ces deux bugs se manifestaient UNIQUEMENT en navigateur réel — les tests
 * userEvent passaient déjà en jsdom sur la version buguée.
 */

describe('Select — hotfix 4f : pointer-events sur les items', () => {
  it('clic sur item dans Select isolé → onValueChange fire avec la bonne valeur', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Select value="" onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Sélectionner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="F">Femme</SelectItem>
          <SelectItem value="M">Homme</SelectItem>
          <SelectItem value="Autre">Autre</SelectItem>
        </SelectContent>
      </Select>,
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Homme' }));

    expect(onValueChange).toHaveBeenCalled();
    expect(onValueChange.mock.calls[0]?.[0]).toBe('M');
  });

  it('clic sur item dans un Form (pattern RHF + FormControl) → form state mis à jour', async () => {
    const user = userEvent.setup();

    function Harness() {
      const form = useForm<{ sexe: string | undefined }>({
        defaultValues: { sexe: undefined },
      });
      const current = form.watch('sexe');
      return (
        <Form {...form}>
          <form>
            <span data-testid="state">{current ?? 'vide'}</span>
            <FormField
              control={form.control}
              name="sexe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sexe</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v ?? undefined)}
                    value={field.value ?? ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="F">Femme</SelectItem>
                      <SelectItem value="M">Homme</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </form>
        </Form>
      );
    }
    render(<Harness />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Homme' }));

    expect(screen.getByTestId('state').textContent).toBe('M');
  });

  it('le Popup porte bien la classe `pointer-events-auto` pour lever l\'héritage du Positioner', async () => {
    const user = userEvent.setup();
    render(
      <Select value="" onValueChange={() => {}}>
        <SelectTrigger>
          <SelectValue placeholder="Sélectionner" />
        </SelectTrigger>
        <SelectContent data-testid="popup">
          <SelectItem value="F">Femme</SelectItem>
        </SelectContent>
      </Select>,
    );
    await user.click(screen.getByRole('combobox'));

    const popup = await screen.findByTestId('popup');
    expect(popup.className).toContain('pointer-events-auto');
  });

  it('SelectValue avec children function : affiche le libellé résolu, pas la valeur brute', async () => {
    const user = userEvent.setup();
    const LIBELLES: Record<string, string> = { F: 'Femme', M: 'Homme' };

    function Harness() {
      const [v, setV] = React.useState('');
      return (
        <Select value={v} onValueChange={(val) => setV(val ?? '')}>
          <SelectTrigger>
            <SelectValue>
              {(current: string | null) =>
                current ? (LIBELLES[current] ?? current) : 'Sélectionner'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="F">Femme</SelectItem>
            <SelectItem value="M">Homme</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('combobox');
    expect(trigger.textContent).toContain('Sélectionner');

    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Homme' }));

    // Le trigger doit afficher « Homme » (libellé) — PAS « M » (valeur brute).
    expect(trigger.textContent).toContain('Homme');
    expect(trigger.textContent).not.toContain('M\u200B');
  });
});
