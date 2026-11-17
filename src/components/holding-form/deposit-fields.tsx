// Part of the add/edit holding form (src/app/holding/edit.tsx): the fields of a deposit (TRY or foreign currency). The form keeps all
// state; this component only lays out the fields it is given.

import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { Field } from '@/components/ui';
import { CURRENCY_SYMBOL } from '@/lib/types';

import type { FormErrors } from './form-types';

type Props = {
  fxDeposit: 'usd' | 'eur' | undefined;
  principal: string;
  setPrincipal: (t: string) => void;
  gross: string;
  setGross: (t: string) => void;
  term: string;
  setTerm: (t: string) => void;
  withholding: string;
  setWithholding: (t: string) => void;
  autoWithholding: number;
  buyDate: string | undefined;
  setBuyDate: (d: string | undefined) => void;
  today: string;
  unitCost: string;
  setUnitCost: (t: string) => void;
  rateNote: string | undefined;
  setRateNote: (t: string | undefined) => void;
  errors: FormErrors;
  show: (e: string | undefined) => string | undefined;
};

export function DepositFields({ fxDeposit, principal, setPrincipal, show, errors, gross, setGross, term, setTerm, autoWithholding, withholding, setWithholding, buyDate, setBuyDate, today, unitCost, setUnitCost, setRateNote, rateNote }: Props) {
  return (
    <>
      <Field
        label="Yatırdığın tutar"
        prefix={fxDeposit ? CURRENCY_SYMBOL[fxDeposit] : '₺'}
        keyboardType="decimal-pad"
        placeholder={fxDeposit ? '10.000' : '100.000'}
        value={principal}
        onChangeText={setPrincipal}
        error={show(fxDeposit ? errors.quantity : errors.cost)}
      />
      <View style={styles.pair}>
        <Field style={styles.flex} label="Yıllık brüt faiz" prefix="%" keyboardType="decimal-pad" placeholder={fxDeposit ? '2' : '40'} value={gross} onChangeText={setGross} error={show(errors.gross)} />
        <Field style={styles.flex} label="Vade" suffix="gün" keyboardType="number-pad" placeholder="32" value={term} onChangeText={setTerm} error={show(errors.term)} />
      </View>
      <Field
        label="Stopaj"
        prefix="%"
        keyboardType="decimal-pad"
        placeholder={String(autoWithholding).replace('.', ',')}
        value={withholding}
        onChangeText={setWithholding}
        error={show(errors.withholding)}
        hint={
          fxDeposit
            ? `Döviz mevduatında stopaj %${autoWithholding}; boş bırakırsan bu uygulanır.`
            : `Boş bırakırsan vadeye göre %${String(autoWithholding).replace('.', ',')} uygulanır.`
        }
      />
      <DateField label="Başlangıç tarihi" value={buyDate} onChange={setBuyDate} max={today} />
      {fxDeposit && (
        <Field
          label="Yatırdığın günkü kur"
          prefix="₺"
          decimals={4}
          keyboardType="decimal-pad"
          value={unitCost}
          onChangeText={(t) => { setUnitCost(t); setRateNote(undefined); }}
          error={show(errors.cost)}
          hint={rateNote ?? 'TL karşılığını ve reel getiriyi bu kurdan hesaplarız; güncel kur otomatik alınır.'}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pair: { flexDirection: 'row', gap: 12 },
});
